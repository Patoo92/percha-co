var PLAN_PRICES = { Freemium: 0, Plus: 9.99, Pro: 14.99 };
var FEATURED_PRICES = {
  Ninguno: 0,
  "1_Semana": 1.99,
  "2_Semanas": 2.99,
  "3_Semanas": 4.99,
  "1_Mes": 9.99
};
var MAX_FEATURED_SELLERS = 5;
var MAX_ID_DOCUMENT_BYTES = 5 * 1024 * 1024;
var MAX_PUBLIC_IMAGE_BYTES = 5 * 1024 * 1024;
var MAX_PRODUCT_IMAGES = 3;
var MAX_FEATURED_PRODUCT_IMAGES = 5;
var PRODUCT_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
var STORE_CONTACT_EMAIL = "patoog58@gmail.com";
var STORE_WHATSAPP_NUMBER = "34600369376";
var BIZUM_PHONE_NUMBER = "+34 600 369 376";
var MAX_REGISTROS_POR_EMAIL = 3;
var MAX_REGISTROS_GLOBALES_HORA = 20;

function neutralizarFormula_(value) {
  var text = String(value == null ? "" : value);
  return /^\s*[=+\-@]/.test(text) ? "'" + text : text;
}

function validacionError_(message) {
  var error = new Error(String(message));
  error.publicMessage = String(message);
  return error;
}

function respuestaError_(error, contexto) {
  if (error && error.publicMessage) {
    return { status: "error", message: error.publicMessage };
  }
  console.error("Error interno en " + contexto + ":", error);
  return {
    status: "error",
    message: "No se pudo completar la solicitud. Inténtalo de nuevo más tarde."
  };
}

function normalizarEmailContacto_(value) {
  var text = String(value == null ? "" : value).trim();
  if (/^'[=+\-@]/.test(text)) text = text.slice(1);
  return text.toLowerCase();
}

function normalizarEmailHoja_(value) {
  var email = normalizarEmailContacto_(value);
  var at = email.lastIndexOf("@");
  if (at < 1) return email;

  var local = email.slice(0, at);
  var domain = email.slice(at + 1);
  if (domain !== "gmail.com" && domain !== "googlemail.com") return email;

  var plus = local.indexOf("+");
  if (plus > 0) local = local.slice(0, plus);
  return local.replace(/\./g, "") + "@gmail.com";
}

function escaparHtml_(value) {
  return String(value).replace(/[&<>"']/g, function (character) {
    return {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[character];
  });
}

function etiquetaPlan_(plan) {
  return {
    Freemium: "Freemium",
    Plus: "Plus",
    Pro: "Pro"
  }[plan] || plan;
}

function etiquetaDestaque_(destaque) {
  return {
    Ninguno: "Sin destaque",
    "1_Semana": "1 semana",
    "2_Semanas": "2 semanas",
    "3_Semanas": "3 semanas",
    "1_Mes": "1 mes"
  }[destaque] || destaque;
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("Percha & Co.")
    .addItem("Cargar imágenes del producto", "abrirCargaImagenesProducto")
    .addItem("Aplicar solicitud seleccionada", "aplicarSolicitudImagenSeleccionada")
    .addItem("Proteger columna de imágenes", "protegerImagenesCatalogo")
    .addItem("Enviar bienvenida al vendedor seleccionado", "enviarBienvenidaSeleccionada")
    .addItem("Rechazar vendedor seleccionado", "rechazarVendedorSeleccionado")
    .addItem("Suspender producto seleccionado", "suspenderProductoSeleccionado")
    .addItem("Limpiar imágenes temporales", "limpiarCargasTemporalesAbandonadas")
    .addToUi();
}

function emailActivo_() {
  var email = String(Session.getActiveUser().getEmail() || "").trim().toLowerCase();
  if (!email) {
    throw new Error("Google no pudo identificar tu cuenta. Inicia sesión con el correo registrado en VENDEDORES_MKP.");
  }
  return email;
}

function emailPropietario_() {
  return String(
    PropertiesService.getScriptProperties().getProperty("STORE_OWNER_EMAIL") ||
    STORE_CONTACT_EMAIL
  ).trim().toLowerCase();
}

function hashSellerSecret_(value) {
  var properties = PropertiesService.getScriptProperties();
  var pepper = properties.getProperty("SELLER_AUTH_PEPPER");
  if (!pepper) {
    pepper = Utilities.getUuid() + Utilities.getUuid();
    properties.setProperty("SELLER_AUTH_PEPPER", pepper);
  }
  return Utilities.base64EncodeWebSafe(
    Utilities.computeHmacSha256Signature(String(value), pepper)
  );
}

function buscarVendedorPorEmail_(email) {
  email = normalizarEmailHoja_(email);
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("VENDEDORES_MKP");
  if (!sheet || sheet.getLastRow() < 2) return null;

  var headers = leerEncabezados_(sheet);
  var rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).getValues();
  var emailCol = indiceColumna_(headers, "Email");
  var idCol = indiceColumna_(headers, "ID_Vendedor");
  var activeCol = indiceColumna_(headers, "Activo");
  var paymentCol = indiceColumna_(headers, "Estado_pago");
  var planCol = indiceColumna_(headers, "Plan");
  var matches = [];
  for (var index = 0; index < rows.length; index++) {
    if (normalizarEmailHoja_(rows[index][emailCol]) !== email) continue;

    var active = String(rows[index][activeCol] || "").trim().toLowerCase();
    var payment = String(rows[index][paymentCol] || "").trim().toLowerCase();
    if (["si", "sí", "true", "activo"].indexOf(active) < 0 ||
        (payment !== "aprobado" && payment !== "no_requerido")) continue;

    matches.push({
      id: String(rows[index][idCol] || "").trim(),
      email: email,
      plan: String(rows[index][planCol] || "").trim()
    });
  }

  if (matches.length > 1) {
    console.error("Hay varias cuentas activas con el mismo correo; se bloquea el acceso OTP para evitar ambigüedad.");
    return null;
  }
  return matches.length === 1 ? matches[0] : null;
}

function solicitarCodigoAccesoVendedor(email) {
  var contactEmail = normalizarEmailContacto_(email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
    throw validacionError_("Introduce un correo electrónico válido.");
  }

  var emailKey = normalizarEmailHoja_(contactEmail);
  var emailHash = hashSellerSecret_(emailKey);
  var cache = CacheService.getScriptCache();
  var throttleKey = "seller-otp-throttle:" + emailHash;
  if (cache.get(throttleKey)) {
    return { status: "success", message: "Si la cuenta está aprobada, recibirás un código por correo." };
  }
  var quotaKey = "seller-otp-quota:" + emailHash;
  var sentInWindow = Number(cache.get(quotaKey) || 0);
  if (sentInWindow >= 5) {
    return { status: "success", message: "Si la cuenta está aprobada, recibirás un código por correo." };
  }

  var seller = buscarVendedorPorEmail_(contactEmail);
  if (seller) {
    var code = String(
      parseInt(Utilities.getUuid().replace(/-/g, "").slice(0, 8), 16) % 1000000
    ).padStart(6, "0");
    cache.put("seller-otp:" + emailHash, JSON.stringify({
      sellerId: seller.id,
      codeHash: hashSellerSecret_(emailKey + ":" + code),
      attempts: 0
    }), 600);
    try {
      MailApp.sendEmail({
        to: contactEmail,
        subject: "Tu código de acceso a Percha&Co",
        body: "Tu código de acceso de vendedor es " + code +
          ". Caduca en 10 minutos. Si no solicitaste este código, ignora el mensaje.",
        name: "Percha&Co",
        replyTo: STORE_CONTACT_EMAIL
      });
      cache.put(quotaKey, String(sentInWindow + 1), 21600);
    } catch (mailError) {
      cache.remove("seller-otp:" + emailHash);
      console.error("No se pudo enviar el código de acceso al vendedor.", mailError);
      throw validacionError_("No se pudo enviar el código. Inténtalo más tarde o contacta con la tienda.");
    }
  }

  cache.put(throttleKey, "1", 60);
  return { status: "success", message: "Si la cuenta está aprobada, recibirás un código por correo." };
}

function verificarCodigoAccesoVendedor(email, code) {
  var contactEmail = normalizarEmailContacto_(email);
  var emailKey = normalizarEmailHoja_(contactEmail);
  code = String(code || "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail) || !/^\d{6}$/.test(code)) {
    throw validacionError_("El correo o el código no son válidos.");
  }

  var cache = CacheService.getScriptCache();
  var emailHash = hashSellerSecret_(emailKey);
  var otpKey = "seller-otp:" + emailHash;
  var raw = cache.get(otpKey);
  if (!raw) throw validacionError_("El código caducó o no es válido. Solicita uno nuevo.");

  var otp = JSON.parse(raw);
  if (otp.attempts >= 5) {
    cache.remove(otpKey);
    throw validacionError_("Se agotaron los intentos. Solicita un nuevo código.");
  }
  if (otp.codeHash !== hashSellerSecret_(emailKey + ":" + code)) {
    otp.attempts++;
    cache.put(otpKey, JSON.stringify(otp), 600);
    throw validacionError_("El código no es correcto.");
  }
  cache.remove(otpKey);

  var seller = buscarVendedorPorEmail_(contactEmail);
  if (!seller || seller.id !== otp.sellerId) {
    throw validacionError_("La cuenta ya no está activa. Contacta con la tienda.");
  }
  var token = Utilities.getUuid() + Utilities.getUuid();
  cache.put("seller-session:" + hashSellerSecret_(token), seller.id, 21600);
  return { status: "success", token: token, sellerId: seller.id, plan: seller.plan };
}

function validarSesionVendedor_(token) {
  token = String(token || "");
  if (!/^[A-Za-z0-9-]{60,80}$/.test(token)) {
    throw validacionError_("La sesión caducó. Vuelve a solicitar un código de acceso.");
  }
  var sellerId = CacheService.getScriptCache().get(
    "seller-session:" + hashSellerSecret_(token)
  );
  if (!sellerId) throw validacionError_("La sesión caducó. Vuelve a solicitar un código de acceso.");
  var email = obtenerEmailVendedor(SpreadsheetApp.getActiveSpreadsheet(), sellerId)
    .trim().toLowerCase();
  var seller = buscarVendedorPorEmail_(email);
  if (!seller || seller.id !== sellerId) {
    throw validacionError_("La cuenta ya no está activa. Contacta con la tienda.");
  }
  return seller;
}

function subirImagenProductoVendedor(token, file) {
  var seller = validarSesionVendedor_(token);
  if (!file || typeof file.base64 !== "string" ||
      PRODUCT_IMAGE_TYPES.indexOf(String(file.mimeType || "").toLowerCase()) < 0) {
    throw validacionError_("Selecciona una imagen JPG, PNG, GIF o WebP válida.");
  }
  if (file.base64.length > Math.ceil(MAX_PUBLIC_IMAGE_BYTES / 3) * 4 + 4) {
    throw validacionError_("Cada imagen debe pesar como máximo 5 MB.");
  }

  var bytes = Utilities.base64Decode(file.base64.replace(/^data:[^;]+;base64,/i, ""));
  if (!bytes.length || bytes.length > MAX_PUBLIC_IMAGE_BYTES) {
    throw validacionError_("Cada imagen debe pesar más de 0 y como máximo 5 MB.");
  }
  var first = bytes.slice(0, 8).map(function (byte) { return (byte + 256) % 256; });
  var mimeType = String(file.mimeType).toLowerCase();
  var validSignature = mimeType === "image/jpeg"
    ? first[0] === 255 && first[1] === 216 && first[2] === 255
    : mimeType === "image/png"
      ? first.join(",") === "137,80,78,71,13,10,26,10"
      : mimeType === "image/gif"
        ? String.fromCharCode.apply(null, first.slice(0, 3)) === "GIF"
        : String.fromCharCode.apply(null, first.slice(0, 4)) === "RIFF" &&
          String.fromCharCode.apply(null, bytes.slice(8, 12).map(function (byte) {
            return (byte + 256) % 256;
          })) === "WEBP";
  if (!validSignature) throw validacionError_("El contenido no coincide con el formato de imagen.");

  var safeName = String(file.name || "producto").replace(/[\u0000-\u001f\\/:*?"<>|]/g, "_").slice(0, 150);
  if (/^\s*[=+\-@]/.test(safeName)) safeName = "_" + safeName;
  var driveFile = obtenerCarpetaImagenesProducto_().createFile(
    Utilities.newBlob(bytes, mimeType, safeName || "producto")
  );
  var uploadToken = Utilities.getUuid();
  CacheService.getScriptCache().put(
    "seller-product-upload:" + driveFile.getId(),
    JSON.stringify({ token: uploadToken, sellerId: seller.id }),
    1800
  );
  return { status: "success", id: driveFile.getId(), token: uploadToken, name: driveFile.getName() };
}

function obtenerCargaProductoVendedor_(seller, upload) {
  if (!upload || typeof upload.id !== "string" || !/^[A-Za-z0-9_-]{20,}$/.test(upload.id) ||
      typeof upload.token !== "string") {
    throw validacionError_("Una imagen cargada ya no es válida. Vuelve a subirla.");
  }
  var cache = CacheService.getScriptCache();
  var key = "seller-product-upload:" + upload.id;
  var record = cache.get(key);
  if (!record) throw validacionError_("Una carga caducó. Vuelve a subir la imagen.");
  record = JSON.parse(record);
  if (record.sellerId !== seller.id || record.token !== upload.token) {
    throw validacionError_("Una imagen cargada no pertenece a esta sesión.");
  }
  var file = DriveApp.getFileById(upload.id);
  var parents = file.getParents();
  var inProductFolder = false;
  var folderId = obtenerCarpetaImagenesProducto_().getId();
  while (parents.hasNext()) {
    if (parents.next().getId() === folderId) inProductFolder = true;
  }
  if (!inProductFolder || PRODUCT_IMAGE_TYPES.indexOf(file.getMimeType()) < 0 ||
      file.getSize() > MAX_PUBLIC_IMAGE_BYTES) {
    throw validacionError_("Una imagen no cumple los requisitos o no está en la carpeta privada.");
  }
  return { file: file, cacheKey: key };
}

function cancelarCargaProductoVendedor(token, uploads) {
  var seller = validarSesionVendedor_(token);
  if (!Array.isArray(uploads)) throw validacionError_("La lista de imágenes no es válida.");
  uploads.forEach(function (upload) {
    var entry = obtenerCargaProductoVendedor_(seller, upload);
    entry.file.setTrashed(true);
    CacheService.getScriptCache().remove(entry.cacheKey);
  });
  return { status: "success" };
}

function listarProductosVendedor(token) {
  var seller = validarSesionVendedor_(token);
  var catalog = obtenerHojaCatalogo_(SpreadsheetApp.getActiveSpreadsheet());
  var headers = leerEncabezados_(catalog);
  var rows = catalog.getLastRow() > 1
    ? catalog.getRange(2, 1, catalog.getLastRow() - 1, headers.length).getDisplayValues()
    : [];
  var sellerInfo = obtenerMapaVendedores_()[seller.id];
  var sellerCol = indiceColumna_(headers, "ID_Vendedor");
  var nameCol = indiceColumna_(headers, "Producto");
  var statusCol = indiceColumna_(headers, "Activo");
  var idCol = indiceColumna_(headers, "ID");
  var availabilityCol = indiceColumnaOpcional_(headers, "Disponibilidad");
  var reasonCol = headers.findIndex(function (header) {
    return normalizarEncabezado_(header) === normalizarEncabezado_("Motivo_Rechazo");
  });
  var owned = rows.filter(function (row) { return String(row[sellerCol]) === seller.id; });
  var statuses = owned.map(function (row) {
    var status = String(row[statusCol] || "");
    var isSuspended = status.trim().toLowerCase() === "suspendido";
    return {
      id: String(row[idCol] || "").trim(),
      name: String(row[nameCol] || ""),
      status: status,
      availability: normalizarDisponibilidadProducto_(
        availabilityCol >= 0 ? row[availabilityCol] : ""
      ),
      reason: isSuspended
        ? textoMotivoRechazo_(
          reasonCol >= 0 ? row[reasonCol] : "",
          "El producto no cumple los requisitos de la tienda."
        )
        : ""
    };
  });
  return {
    status: "success",
    sellerId: seller.id,
    plan: seller.plan,
    canFeature: Boolean(sellerInfo && sellerInfo.featured && !sellerInfo.featuredProductId),
    count: owned.filter(function (row) {
      return String(row[indiceColumna_(headers, "Activo")]).toLowerCase() !== "suspendido";
    }).length,
    limit: seller.plan === "Freemium" ? 5 : seller.plan === "Plus" ? 10 : 20,
    products: statuses
  };
}

function actualizarDisponibilidadProductoVendedor(token, productId, availability) {
  var seller = validarSesionVendedor_(token);
  productId = String(productId || "").trim();
  availability = String(availability || "").trim().toLowerCase();
  if (!productId || ["disponible", "agotado", "bajo pedido"].indexOf(availability) < 0) {
    throw validacionError_("Selecciona una disponibilidad válida.");
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var catalog = obtenerHojaCatalogo_(SpreadsheetApp.getActiveSpreadsheet());
    var headers = asegurarColumnaDisponibilidadCatalogo_(catalog);
    var lastRow = catalog.getLastRow();
    if (lastRow < 2) throw validacionError_("No se encontró el producto.");

    var rows = catalog.getRange(2, 1, lastRow - 1, headers.length).getDisplayValues();
    var idCol = indiceColumna_(headers, "ID");
    var sellerCol = indiceColumna_(headers, "ID_Vendedor");
    var availabilityCol = indiceColumna_(headers, "Disponibilidad");
    var rowIndex = rows.findIndex(function (row) {
      return String(row[idCol] || "").trim() === productId;
    });
    if (rowIndex < 0 || String(rows[rowIndex][sellerCol] || "").trim() !== seller.id) {
      throw validacionError_("No se encontró un producto tuyo para actualizar.");
    }

    catalog.getRange(rowIndex + 2, availabilityCol + 1)
      .setValue(etiquetaDisponibilidadProducto_(availability));
    return {
      status: "success",
      id: productId,
      availability: availability
    };
  } finally {
    lock.releaseLock();
  }
}

function crearProductoVendedor(token, data) {
  var seller = validarSesionVendedor_(token);
  data = data || {};
  var name = String(data.name || "").trim();
  var category = String(data.category || "").trim().toLowerCase();
  var description = String(data.description || "").trim();
  if (data.price === undefined || data.price === null || String(data.price).trim() === "") {
    throw validacionError_("Introduce un precio válido entre 0 y 100.000 €.");
  }
  var price = Number(data.price);
  var sizes = Array.isArray(data.sizes) ? data.sizes : [];
  var images = Array.isArray(data.images) ? data.images : [];
  var featured = data.featured === true;
  var availability = String(data.availability || "disponible").trim().toLowerCase();
  if (name.length < 2 || name.length > 100 || /^[=+\-@]/.test(name)) {
    throw validacionError_("El nombre debe tener entre 2 y 100 caracteres y ser texto.");
  }
  if (["disponible", "agotado", "bajo pedido"].indexOf(availability) < 0) {
    throw validacionError_("Selecciona una disponibilidad válida.");
  }
  if (!Number.isFinite(price) || price < 0 || price > 100000) {
    throw validacionError_("Introduce un precio válido entre 0 y 100.000 €.");
  }
  if (["ropa", "productos"].indexOf(category) < 0) {
    throw validacionError_("Selecciona una categoría válida.");
  }
  if (description.length > 1000 || /^[=+\-@]/.test(description)) {
    throw validacionError_("La descripción no puede superar 1.000 caracteres ni comenzar con un símbolo de fórmula.");
  }
  if (category !== "ropa" && sizes.length) {
    throw validacionError_("Solo se pueden indicar talles para productos de ropa.");
  }
  if (sizes.length > 20 || sizes.some(function (size) {
    return typeof size !== "string" || size.trim().length > 20 || /^[=+\-@]/.test(size.trim());
  })) {
    throw validacionError_("Revisa la lista de talles.");
  }
  var sellerInfo = obtenerMapaVendedores_()[seller.id];
  if (featured && (!sellerInfo || !sellerInfo.featured ||
      (sellerInfo.featuredProductId && sellerInfo.featuredProductId !== String(data.id || "")))) {
    throw validacionError_("El destaque debe estar activo y disponible para esta publicación.");
  }
  var maxImages = featured ? MAX_FEATURED_PRODUCT_IMAGES : MAX_PRODUCT_IMAGES;
  if (images.length < 1 || images.length > maxImages) {
    throw validacionError_("Esta publicación admite entre 1 y " + maxImages + " imágenes.");
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  var createdFiles = [];
  try {
    if (!puedeSubirProducto(seller.id)) {
      throw validacionError_("Alcanzaste el límite de productos de tu plan.");
    }
    var uploaded = images.map(function (image) {
      var verified = obtenerCargaProductoVendedor_(seller, image);
      createdFiles.push(verified);
      return verified;
    });

    var catalog = obtenerHojaCatalogo_(SpreadsheetApp.getActiveSpreadsheet());
    var headers = asegurarColumnaDisponibilidadCatalogo_(catalog);
    var productId = "P-" + Utilities.getUuid();
    var fields = {
      producto: name,
      precioventa: price,
      imageurl: "",
      id: productId,
      categoria: category,
      descripcion: description,
      talles: category === "ropa" ? sizes.map(function (size) { return size.trim(); }).join(", ") : "",
      disponibilidad: etiquetaDisponibilidadProducto_(availability),
      activo: "Pendiente",
      idvendedor: seller.id,
      fechasubida: new Date()
    };
    var row = headers.map(function (header) {
      var key = normalizarEncabezado_(header);
      return Object.prototype.hasOwnProperty.call(fields, key) ? fields[key] : "";
    });
    catalog.appendRow(row);
    var productRow = catalog.getLastRow();
    var imageCol = indiceColumna_(headers, "Image_URL") + 1;
    var richText = SpreadsheetApp.newRichTextValue();
    var names = uploaded.map(function (entry) { return entry.file.getName(); });
    richText.setText(names.join("\n"));
    var offset = 0;
    uploaded.forEach(function (entry, index) {
      var end = offset + names[index].length;
      richText.setLinkUrl(offset, end, entry.file.getUrl());
      offset = end + (index < names.length - 1 ? 1 : 0);
    });
    catalog.getRange(productRow, imageCol).setRichTextValue(richText.build());
    if (featured && (!sellerInfo.featuredProductId || sellerInfo.featuredProductId === productId)) {
      var sellers = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("VENDEDORES_MKP");
      var sellerHeaders = asegurarColumnasRevisionVendedor_(sellers);
      var sellerRows = sellers.getRange(2, 1, sellers.getLastRow() - 1, sellerHeaders.length).getValues();
      var idCol = indiceColumna_(sellerHeaders, "ID_Vendedor");
      var sellerIndex = sellerRows.findIndex(function (row) { return String(row[idCol]) === seller.id; });
      if (sellerIndex >= 0) {
        asignarCelda_(sellers, sellerHeaders, sellerIndex + 2, "ID_Producto_Destacado", productId);
      }
    }
    CacheService.getScriptCache().removeAll(createdFiles.map(function (entry) { return entry.cacheKey; }));
    try {
      MailApp.sendEmail({
        to: STORE_CONTACT_EMAIL,
        subject: "Nuevo producto pendiente de revisión — Percha&Co",
        body: "El vendedor " + seller.id + " envió «" + name + "» para revisión. " +
          "El producto quedó en Pendiente en la hoja del catálogo."
      });
    } catch (mailError) {
      console.error("No se pudo avisar a la tienda del nuevo producto " + productId + ".", mailError);
    }
    return { status: "success", id: productId, name: name, state: "Pendiente" };
  } finally {
    lock.releaseLock();
  }
}

function asegurarColumnasRevisionVendedor_(sheet) {
  var headers = leerEncabezados_(sheet);
  [
    "Estado_Revision", "Fecha_Bienvenida", "Fecha_Cancelacion",
    "Motivo_Rechazo", "Fecha_Aviso_Rechazo"
  ].forEach(function (name) {
    var key = normalizarEncabezado_(name);
    if (headers.some(function (header) {
      return normalizarEncabezado_(header) === key;
    })) return;

    sheet.getRange(1, headers.length + 1).setValue(name);
    headers.push(name);
  });

  if (sheet.getLastRow() < 2) return headers;
  var rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).getValues();
  var idCol = indiceColumna_(headers, "ID_Vendedor");
  var activeCol = indiceColumna_(headers, "Activo");
  var paymentCol = indiceColumna_(headers, "Estado_pago");
  var reviewCol = indiceColumna_(headers, "Estado_Revision");
  rows.forEach(function (row, index) {
    if (!row[idCol] || row[reviewCol]) return;

    var active = String(row[activeCol] || "").trim().toLowerCase();
    var payment = String(row[paymentCol] || "").trim().toLowerCase();
    var state = ["si", "sí", "true", "activo"].indexOf(active) >= 0
      ? "Aprobado"
      : ["rechazado", "cancelado"].indexOf(payment) >= 0
        ? "Rechazado"
        : "Pendiente";
    sheet.getRange(index + 2, reviewCol + 1).setValue(state);
  });
  return headers;
}

function asegurarColumnasRechazoCatalogo_(sheet) {
  var headers = leerEncabezados_(sheet);
  ["Motivo_Rechazo", "Fecha_Aviso_Rechazo"].forEach(function (name) {
    var key = normalizarEncabezado_(name);
    if (headers.some(function (header) {
      return normalizarEncabezado_(header) === key;
    })) return;

    sheet.getRange(1, headers.length + 1).setValue(name);
    headers.push(name);
  });
  return headers;
}

function textoMotivoRechazo_(value, fallback) {
  var text = String(value || "").trim();
  if (/^'[=+\-@]/.test(text)) text = text.slice(1);
  return text || fallback;
}

function limpiarAvisoRechazo_(sheet, headers, rowNumber) {
  ["Motivo_Rechazo", "Fecha_Aviso_Rechazo"].forEach(function (name) {
    var index = headers.findIndex(function (header) {
      return normalizarEncabezado_(header) === normalizarEncabezado_(name);
    });
    if (index < 0) return;
    var cell = sheet.getRange(rowNumber, index + 1);
    if (cell.getValue()) cell.setValue("");
  });
}

function notificarRechazoVendedor_(sheet, headers, rowNumber, motivo, asunto, intro) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    headers = asegurarColumnasRevisionVendedor_(sheet);
    var noticeCol = indiceColumna_(headers, "Fecha_Aviso_Rechazo") + 1;
    if (sheet.getRange(rowNumber, noticeCol).getValue()) return false;

    var email = String(
      sheet.getRange(rowNumber, indiceColumna_(headers, "Email") + 1).getValue() || ""
    ).trim();
    var name = String(
      sheet.getRange(rowNumber, indiceColumna_(headers, "Nombre") + 1).getValue() || ""
    ).trim();
    if (!email) return false;

    var reason = textoMotivoRechazo_(
      sheet.getRange(rowNumber, indiceColumna_(headers, "Motivo_Rechazo") + 1).getValue(),
      motivo || "No se indicó un motivo concreto. Responde a este correo para revisarlo."
    );

    try {
      MailApp.sendEmail({
        to: email,
        subject: asunto || "Tu solicitud de vendedor no ha sido aprobada - Percha&Co",
        body: "Hola" + (name ? " " + name : "") + ",\n\n" +
          (intro || "Tu solicitud de vendedor en Percha&Co no ha sido aprobada.") + "\n\n" +
          "Motivo: " + reason + "\n\n" +
          "Si crees que es un error o necesitas más información, responde a este correo " +
          "o escríbenos por WhatsApp.\n\n" +
          "El equipo de Percha&Co",
        name: "Percha&Co",
        replyTo: STORE_CONTACT_EMAIL
      });
    } catch (mailError) {
      console.error("No se pudo enviar el aviso de rechazo al vendedor.", mailError);
      return false;
    }

    sheet.getRange(rowNumber, noticeCol).setValue(new Date());
    return true;
  } finally {
    lock.releaseLock();
  }
}

function notificarRechazoProducto_(sheet, headers, rowNumber, motivo) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    headers = asegurarColumnasRechazoCatalogo_(sheet);
    var noticeCol = indiceColumna_(headers, "Fecha_Aviso_Rechazo") + 1;
    if (sheet.getRange(rowNumber, noticeCol).getValue()) return false;

    var sellerId = String(
      sheet.getRange(rowNumber, indiceColumna_(headers, "ID_Vendedor") + 1).getValue() || ""
    ).trim();
    var email = obtenerEmailVendedor(SpreadsheetApp.getActiveSpreadsheet(), sellerId);
    if (!email) return false;

    var productName = String(
      sheet.getRange(rowNumber, indiceColumna_(headers, "Producto") + 1).getDisplayValue() || ""
    ).trim();
    var reason = textoMotivoRechazo_(
      sheet.getRange(rowNumber, indiceColumna_(headers, "Motivo_Rechazo") + 1).getValue(),
      motivo || "No se indicó un motivo concreto. Responde a este correo para revisarlo."
    );

    try {
      MailApp.sendEmail({
        to: email,
        subject: "Producto no publicado en Percha&Co",
        body: "Hola,\n\n" +
          "El producto '" + productName + "' no se ha publicado o ha sido retirado de la tienda.\n\n" +
          "Motivo: " + reason + "\n\n" +
          "Si crees que es un error o necesitas más información, responde a este correo " +
          "o escríbenos por WhatsApp.\n\n" +
          "El equipo de Percha&Co",
        name: "Percha&Co",
        replyTo: STORE_CONTACT_EMAIL
      });
    } catch (mailError) {
      console.error("No se pudo enviar el aviso de producto no publicado.", mailError);
      return false;
    }

    sheet.getRange(rowNumber, noticeCol).setValue(new Date());
    return true;
  } finally {
    lock.releaseLock();
  }
}

function enviarBienvenidaVendedor_(sheet, headers, rowNumber) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    headers = asegurarColumnasRevisionVendedor_(sheet);
    var welcomeCol = indiceColumna_(headers, "Fecha_Bienvenida") + 1;
    if (sheet.getRange(rowNumber, welcomeCol).getValue()) return false;

    var email = String(
      sheet.getRange(rowNumber, indiceColumna_(headers, "Email") + 1).getValue() || ""
    ).trim();
    var name = String(
      sheet.getRange(rowNumber, indiceColumna_(headers, "Nombre") + 1).getValue() || ""
    ).trim();
    var sellerId = String(
      sheet.getRange(rowNumber, indiceColumna_(headers, "ID_Vendedor") + 1).getValue() || ""
    ).trim();
    if (!email || !sellerId) throw new Error("Faltan el correo o el ID del vendedor aprobado.");

    try {
      MailApp.sendEmail({
        to: email,
        subject: "Tu cuenta de vendedor est\u00e1 aprobada - Percha&Co",
        body: "Hola " + name + ",\n\n" +
          "Tu cuenta de vendedor de Percha&Co ha sido aprobada.\n" +
          "Tu ID de vendedor es " + sellerId + ".\n\n" +
          "Entra en la tienda de Percha&Co y abre \"Acceso vendedores\". " +
          "Solicita un c\u00f3digo con el correo de esta cuenta para cargar tus productos y consultar su estado. " +
          "Las publicaciones quedan pendientes de revisi\u00f3n antes de mostrarse en la tienda.\n\n" +
          "Si necesitas ayuda, responde a este correo o escr\u00edbenos por WhatsApp.\n\n" +
          "El equipo de Percha&Co",
        name: "Percha&Co",
        replyTo: STORE_CONTACT_EMAIL
      });
    } catch (mailError) {
      console.error("No se pudo enviar el correo de bienvenida al vendedor " + sellerId + ".", mailError);
      return false;
    }
    sheet.getRange(rowNumber, welcomeCol).setValue(new Date());
    return true;
  } finally {
    lock.releaseLock();
  }
}

function enviarBienvenidaSeleccionada() {
  exigirPropietario_();
  var sheet = SpreadsheetApp.getActiveSheet();
  var range = sheet.getActiveRange();
  if (!range || sheet.getName() !== "VENDEDORES_MKP" || range.getRow() < 2) {
    throw new Error("Selecciona una fila de vendedor en VENDEDORES_MKP.");
  }

  var headers = asegurarColumnasRevisionVendedor_(sheet);
  var rowNumber = range.getRow();
  var active = String(
    sheet.getRange(rowNumber, indiceColumna_(headers, "Activo") + 1).getValue() || ""
  ).trim().toLowerCase();
  var payment = String(
    sheet.getRange(rowNumber, indiceColumna_(headers, "Estado_pago") + 1).getValue() || ""
  ).trim().toLowerCase();
  if (["si", "sí", "true", "activo"].indexOf(active) < 0) {
    throw new Error("Solo se puede enviar la bienvenida a una cuenta activa.");
  }
  if (payment !== "aprobado" && payment !== "no_requerido") {
    throw new Error("La cuenta todavía no está aprobada para recibir la bienvenida.");
  }

  var welcomeCol = indiceColumna_(headers, "Fecha_Bienvenida") + 1;
  if (sheet.getRange(rowNumber, welcomeCol).getValue()) {
    SpreadsheetApp.getActiveSpreadsheet().toast(
      "La bienvenida ya consta como enviada.",
      "Percha & Co.",
      8
    );
    return;
  }

  var sent = enviarBienvenidaVendedor_(sheet, headers, rowNumber);
  SpreadsheetApp.getActiveSpreadsheet().toast(
    sent ? "Correo de bienvenida enviado." : "No se pudo enviar; revisa las ejecuciones.",
    "Percha & Co.",
    8
  );
}

function rechazarVendedorSeleccionado() {
  exigirPropietario_();
  var sheet = SpreadsheetApp.getActiveSheet();
  var range = sheet.getActiveRange();
  if (!range || sheet.getName() !== "VENDEDORES_MKP" || range.getRow() < 2) {
    throw new Error("Selecciona una fila de vendedor en VENDEDORES_MKP.");
  }

  var headers = asegurarColumnasRevisionVendedor_(sheet);
  var rowNumber = range.getRow();
  var email = String(
    sheet.getRange(rowNumber, indiceColumna_(headers, "Email") + 1).getValue() || ""
  ).trim();
  if (!email) throw new Error("La fila seleccionada no tiene correo de vendedor.");

  var ui = SpreadsheetApp.getUi();
  var response = ui.prompt(
    "Rechazar vendedor",
    "Motivo del rechazo que recibirá el vendedor (entre 10 y 500 caracteres):",
    ui.ButtonSet.OK_CANCEL
  );
  if (response.getSelectedButton() !== ui.Button.OK) return;

  var reason = String(response.getResponseText() || "").trim();
  if (reason.length < 10 || reason.length > 500) {
    throw new Error("El motivo debe tener entre 10 y 500 caracteres.");
  }

  var now = new Date();
  asignarCelda_(sheet, headers, rowNumber, "Motivo_Rechazo", neutralizarFormula_(reason));
  asignarCelda_(sheet, headers, rowNumber, "Estado_Revision", "Rechazado");
  asignarCelda_(sheet, headers, rowNumber, "Activo", "no");
  asignarCelda_(sheet, headers, rowNumber, "Estado_Destaque", "Cancelado");
  var cancellation = sheet.getRange(
    rowNumber,
    indiceColumna_(headers, "Fecha_Cancelacion") + 1
  ).getValue();
  if (!(cancellation instanceof Date)) {
    asignarCelda_(sheet, headers, rowNumber, "Fecha_Cancelacion", now);
  }

  var sent = notificarRechazoVendedor_(sheet, headers, rowNumber, reason);
  SpreadsheetApp.getActiveSpreadsheet().toast(
    sent ? "Vendedor rechazado y aviso enviado." : "Vendedor rechazado. No se pudo enviar el aviso.",
    "Percha & Co.",
    8
  );
}

function suspenderProductoSeleccionado() {
  exigirPropietario_();
  var sheet = SpreadsheetApp.getActiveSheet();
  var range = sheet.getActiveRange();
  if (!range || !esHojaCatalogo_(sheet) || range.getRow() < 2) {
    throw new Error("Selecciona una fila de producto en la hoja del catálogo.");
  }

  var headers = asegurarColumnasRechazoCatalogo_(sheet);
  var rowNumber = range.getRow();
  var sellerId = String(
    sheet.getRange(rowNumber, indiceColumna_(headers, "ID_Vendedor") + 1).getValue() || ""
  ).trim();
  if (!sellerId) throw new Error("El producto seleccionado no pertenece a un vendedor.");

  var ui = SpreadsheetApp.getUi();
  var response = ui.prompt(
    "Suspender producto",
    "Motivo que recibirá el vendedor (entre 10 y 500 caracteres):",
    ui.ButtonSet.OK_CANCEL
  );
  if (response.getSelectedButton() !== ui.Button.OK) return;

  var reason = String(response.getResponseText() || "").trim();
  if (reason.length < 10 || reason.length > 500) {
    throw new Error("El motivo debe tener entre 10 y 500 caracteres.");
  }

  asignarCelda_(sheet, headers, rowNumber, "Motivo_Rechazo", neutralizarFormula_(reason));
  asignarCelda_(sheet, headers, rowNumber, "Activo", "Suspendido");
  var sent = notificarRechazoProducto_(sheet, headers, rowNumber, reason);
  SpreadsheetApp.getActiveSpreadsheet().toast(
    sent ? "Producto suspendido y aviso enviado." : "Producto suspendido. No se pudo enviar el aviso.",
    "Percha & Co.",
    8
  );
}

function exigirPropietario_() {
  if (emailActivo_() !== emailPropietario_()) {
    throw new Error("Solo la tienda principal puede publicar o reemplazar las imágenes.");
  }
}

function permisoImagenProducto_(sheet, rowNumber) {
  var email = emailActivo_();
  if (email === emailPropietario_()) {
    return { role: "owner", email: email };
  }

  var headers = leerEncabezados_(sheet);
  var sellerId = String(
    sheet.getRange(rowNumber, indiceColumna_(headers, "ID_Vendedor") + 1).getValue() || ""
  ).trim();
  if (!sellerId || normalizarEmailHoja_(obtenerEmailVendedor(
    SpreadsheetApp.getActiveSpreadsheet(),
    sellerId
  )) !== normalizarEmailHoja_(email)) {
    throw new Error("Solo puedes solicitar cambios para tus propios productos usando el correo registrado.");
  }
  var seller = obtenerMapaVendedores_()[sellerId];
  if (!seller || !seller.approved) {
    throw new Error("La cuenta de vendedor debe estar aprobada y activa para solicitar cambios.");
  }
  return { role: "seller", email: email, sellerId: sellerId };
}

function abrirCargaImagenesProducto() {
  var sheet = SpreadsheetApp.getActiveSheet();
  if (!esHojaCatalogo_(sheet)) {
    throw new Error("Selecciona una fila de la hoja del catálogo para cargar imágenes.");
  }
  var activeRange = sheet.getActiveRange();
  if (!activeRange) throw new Error("Selecciona primero la fila de un producto.");
  var rowNumber = activeRange.getRow();
  if (rowNumber < 2) {
    throw new Error("Selecciona la fila de un producto, no los encabezados.");
  }

  var permission = permisoImagenProducto_(sheet, rowNumber);
  var headers = leerEncabezados_(sheet);
  var nameCol = indiceColumna_(headers, "Producto");
  var imageCol = indiceColumna_(headers, "Image_URL");
  var productName = String(sheet.getRange(rowNumber, nameCol + 1).getDisplayValue() || "").trim();
  if (!productName) throw new Error("La fila seleccionada no tiene nombre de producto.");

  var imageCell = sheet.getRange(rowNumber, imageCol + 1);
  var imageCount = referenciasImagen_(imageCell, imageCell.getValue()).length;
  var maxImages = maximoImagenesProducto_(sheet, rowNumber);
  var template = HtmlService.createTemplateFromFile("ProductImageUploader");
  template.rowNumber = rowNumber;
  template.productName = productName;
  template.imageCount = imageCount;
  template.maxImages = maxImages;
  template.isFeatured = maxImages === MAX_FEATURED_PRODUCT_IMAGES;
  template.isStoreOwner = permission.role === "owner";
  SpreadsheetApp.getUi().showModalDialog(
    template.evaluate().setWidth(460).setHeight(permission.role === "owner" ? 420 : 480),
    permission.role === "owner" ? "Cargar imágenes del producto" : "Solicitar cambio de imágenes"
  );
}

function maximoImagenesProducto_(sheet, rowNumber) {
  var headers = leerEncabezados_(sheet);
  var sellerId = String(
    sheet.getRange(rowNumber, indiceColumna_(headers, "ID_Vendedor") + 1).getValue() || ""
  ).trim();
  if (!sellerId) return MAX_PRODUCT_IMAGES;

  var productId = String(
    sheet.getRange(rowNumber, indiceColumna_(headers, "ID") + 1).getValue() || ""
  ).trim();
  var seller = obtenerMapaVendedores_()[sellerId];
  return seller && seller.approved && seller.featured &&
    seller.featuredProductId === productId
    ? MAX_FEATURED_PRODUCT_IMAGES
    : MAX_PRODUCT_IMAGES;
}

function protegerImagenesCatalogo() {
  exigirPropietario_();
  prepararCarpetasFotosVendedores_();
  var sheet = obtenerHojaCatalogo_(SpreadsheetApp.getActiveSpreadsheet());
  var headers = leerEncabezados_(sheet);
  var imageColumn = indiceColumna_(headers, "Image_URL") + 1;
  var range = sheet.getRange(2, imageColumn, sheet.getMaxRows() - 1, 1);
  var description = "Percha & Co.: solo la tienda principal puede editar Image_URL";
  var protection = sheet.getProtections(SpreadsheetApp.ProtectionType.RANGE).filter(
    function (item) { return item.getDescription() === description; }
  )[0];

  if (!protection) protection = range.protect();
  protection.setDescription(description);
  protection.setWarningOnly(false);
  protection.setDomainEdit(false);
  var ownerEmail = emailPropietario_();
  var editors = protection.getEditors().filter(function (editor) {
    return editor.getEmail().toLowerCase() !== ownerEmail;
  });
  if (editors.length) protection.removeEditors(editors);
  protection.addEditor(ownerEmail);
  SpreadsheetApp.getUi().alert(
    "Protección aplicada. Solo " + ownerEmail +
    " puede editar la columna Image_URL; los vendedores deberán enviar una solicitud."
  );
}

function hojaSolicitudesImagenes_(spreadsheet) {
  var name = "SOLICITUDES_CAMBIO_IMAGENES";
  var sheet = spreadsheet.getSheetByName(name);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(name);
    sheet.appendRow([
      "Fecha", "ID_Producto", "Producto", "IDs_Propuestas", "Imagenes_Propuestas",
      "ID_Vendedor", "Email", "Justificacion", "Estado", "Fila_Catalogo",
      "Fecha_Revision", "Revisado_Por"
    ]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function aplicarSolicitudImagenSeleccionada() {
  exigirPropietario_();
  var requestSheet = SpreadsheetApp.getActiveSheet();
  if (requestSheet.getName() !== "SOLICITUDES_CAMBIO_IMAGENES") {
    throw new Error("Abre SOLICITUDES_CAMBIO_IMAGENES y selecciona una solicitud pendiente.");
  }
  var rowNumber = requestSheet.getActiveRange().getRow();
  if (rowNumber < 2) throw new Error("Selecciona una fila de solicitud, no los encabezados.");

  var requestHeaders = leerEncabezados_(requestSheet);
  var statusCol = indiceColumna_(requestHeaders, "Estado") + 1;
  var status = String(requestSheet.getRange(rowNumber, statusCol).getValue() || "")
    .trim().toLowerCase();
  if (status !== "pendiente") throw new Error("La solicitud seleccionada ya no está pendiente.");

  var productId = String(
    requestSheet.getRange(rowNumber, indiceColumna_(requestHeaders, "ID_Producto") + 1).getValue() || ""
  ).trim();
  var catalogRow = Number(
    requestSheet.getRange(rowNumber, indiceColumna_(requestHeaders, "Fila_Catalogo") + 1).getValue()
  );
  var catalog = obtenerHojaCatalogo_(SpreadsheetApp.getActiveSpreadsheet());
  if (!Number.isInteger(catalogRow) || catalogRow < 2 || catalogRow > catalog.getLastRow()) {
    throw new Error("La fila original del producto ya no existe.");
  }
  var catalogHeaders = leerEncabezados_(catalog);
  var currentProductId = String(
    catalog.getRange(catalogRow, indiceColumna_(catalogHeaders, "ID") + 1).getValue() || ""
  ).trim();
  if (currentProductId !== productId) {
    throw new Error("El producto cambió de fila o de ID. No se aplicó la solicitud.");
  }
  var sellerId = String(
    requestSheet.getRange(rowNumber, indiceColumna_(requestHeaders, "ID_Vendedor") + 1).getValue() || ""
  ).trim();
  var productSellerId = String(
    catalog.getRange(
      catalogRow,
      indiceColumna_(catalogHeaders, "ID_Vendedor") + 1
    ).getValue() || ""
  ).trim();
  var sellerEmail = normalizarEmailHoja_(
    requestSheet.getRange(rowNumber, indiceColumna_(requestHeaders, "Email") + 1).getValue()
  );
  var sellerRecord = obtenerMapaVendedores_()[sellerId];
  if (!sellerId || sellerId !== productSellerId ||
      normalizarEmailHoja_(obtenerEmailVendedor(
        SpreadsheetApp.getActiveSpreadsheet(),
        sellerId
      )) !== sellerEmail ||
      !sellerRecord || !sellerRecord.approved) {
    throw new Error("La solicitud ya no corresponde al vendedor propietario del producto.");
  }

  var idsText = String(
    requestSheet.getRange(rowNumber, indiceColumna_(requestHeaders, "IDs_Propuestas") + 1).getValue() || ""
  );
  var imageIds = idsText.split(/\n/).map(function (id) { return id.trim(); }).filter(Boolean);
  var maxImages = maximoImagenesProducto_(catalog, catalogRow);
  if (!imageIds.length || imageIds.length > maxImages) {
    throw new Error("La solicitud no tiene una cantidad válida de imágenes propuestas.");
  }
  var proposalFolder = obtenerCarpetaSolicitudVendedor_(sellerId, sellerEmail);
  var rootFolder = obtenerCarpetaImagenesProducto_();
  var proposalFiles = imageIds.map(function (imageId) {
    if (!/^[A-Za-z0-9_-]{20,}$/.test(imageId)) {
      throw new Error("La solicitud contiene una referencia de imagen no válida.");
    }
    var file = DriveApp.getFileById(imageId);
    var parents = file.getParents();
    var belongsToFolder = false;
    while (parents.hasNext()) {
      if (parents.next().getId() === proposalFolder.getId()) {
        belongsToFolder = true;
        break;
      }
    }
    if (!belongsToFolder || PRODUCT_IMAGE_TYPES.indexOf(file.getMimeType()) < 0 ||
        file.getSize() > MAX_PUBLIC_IMAGE_BYTES) {
      throw new Error("Una imagen propuesta no pertenece a la carpeta del vendedor o no cumple los requisitos.");
    }
    return file;
  });

  var imageCell = catalog.getRange(
    catalogRow,
    indiceColumna_(catalogHeaders, "Image_URL") + 1
  );
  var ui = SpreadsheetApp.getUi();
  var confirmation = ui.alert(
    "Aprobar cambio de imágenes",
    "Esta acción reemplazará las imágenes actuales de «" +
      String(catalog.getRange(catalogRow, indiceColumna_(catalogHeaders, "Producto") + 1).getDisplayValue()) +
      "» por las fotos propuestas. ¿Quieres continuar?",
    ui.ButtonSet.YES_NO
  );
  if (confirmation !== ui.Button.YES) return;

  var approvedImages = [];
  try {
    proposalFiles.forEach(function (file) {
      var copy = file.makeCopy(file.getName(), rootFolder);
      approvedImages.push({ name: copy.getName(), url: copy.getUrl() });
    });

    var text = approvedImages.map(function (image) { return image.name; }).join("\n");
    var richText = SpreadsheetApp.newRichTextValue().setText(text);
    var offset = 0;
    approvedImages.forEach(function (image, index) {
      var end = offset + image.name.length;
      richText.setLinkUrl(offset, end, image.url);
      offset = end + (index < approvedImages.length - 1 ? 1 : 0);
    });
    imageCell.setRichTextValue(richText.build());
    requestSheet.getRange(rowNumber, statusCol).setValue("Aprobada");
    requestSheet.getRange(
      rowNumber,
      indiceColumna_(requestHeaders, "Fecha_Revision") + 1
    ).setValue(new Date());
    requestSheet.getRange(
      rowNumber,
      indiceColumna_(requestHeaders, "Revisado_Por") + 1
    ).setValue(emailActivo_());
  } catch (error) {
    approvedImages.forEach(function (image) {
      var id = extraerIdDrive_(image.url);
      if (id) DriveApp.getFileById(id).setTrashed(true);
    });
    throw error;
  }
}

function doGet(e) {
  try {
    var action = e && e.parameter ? e.parameter.action : "";

    if (action === "productos") {
      return jsonOutput_(obtenerProductosPublicos_());
    }

    if (action === "imagen") {
      return jsonOutput_(obtenerImagenPublica_(e.parameter.id || ""));
    }

    if (action === "disponibilidadDestaque") {
      return jsonOutput_(consultarDisponibilidadDestaque_());
    }

    if (!action) {
      return jsonOutput_({
        status: "success",
        message: "API de Percha&Co funcionando correctamente"
      });
    }

    return jsonOutput_({ status: "error", message: "Acción GET no válida." });
  } catch (error) {
    return jsonOutput_(respuestaError_(error, "doGet"));
  }
}

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      throw validacionError_("Falta el contenido de la solicitud.");
    }

    var data = JSON.parse(e.postData.contents);
    if (data.accion === "registrarVendedor") {
      var registration = registrarVendedor(data);
      return jsonOutput_({
        status: "success",
        idVendedor: registration.idVendedor,
        emailEnviado: registration.emailEnviado,
        avisoTiendaEnviado: registration.avisoTiendaEnviado,
        importe: registration.importe
      });
    }
    if (data.accion === "solicitarCodigoAccesoVendedor") {
      return jsonOutput_(solicitarCodigoAccesoVendedor(data.email));
    }
    if (data.accion === "verificarCodigoAccesoVendedor") {
      return jsonOutput_(verificarCodigoAccesoVendedor(data.email, data.code));
    }
    if (data.accion === "listarProductosVendedor") {
      return jsonOutput_(listarProductosVendedor(data.token));
    }
    if (data.accion === "actualizarDisponibilidadProductoVendedor") {
      return jsonOutput_(actualizarDisponibilidadProductoVendedor(
        data.token,
        data.productId,
        data.availability
      ));
    }
    if (data.accion === "subirImagenProductoVendedor") {
      return jsonOutput_(subirImagenProductoVendedor(data.token, data.file));
    }
    if (data.accion === "cancelarCargaProductoVendedor") {
      return jsonOutput_(cancelarCargaProductoVendedor(data.token, data.images));
    }
    if (data.accion === "crearProductoVendedor") {
      return jsonOutput_(crearProductoVendedor(data.token, data.product));
    }
    return jsonOutput_({ status: "error", message: "Acción no válida." });
  } catch (error) {
    return jsonOutput_(respuestaError_(error, "doPost"));
  }
}

function jsonOutput_(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function normalizarEncabezado_(value) {
  return String(value || "").trim().toLowerCase().replace(/[\s_-]/g, "");
}

function normalizarDisponibilidadProducto_(value) {
  var status = String(value || "").trim().toLowerCase();
  return ["disponible", "agotado", "bajo pedido"].indexOf(status) >= 0
    ? status
    : "disponible";
}

function etiquetaDisponibilidadProducto_(value) {
  var labels = {
    disponible: "Disponible",
    agotado: "Agotado",
    "bajo pedido": "Bajo pedido"
  };
  return labels[normalizarDisponibilidadProducto_(value)];
}

function indiceColumna_(headers, name) {
  var wanted = normalizarEncabezado_(name);
  var index = headers.findIndex(function (header) {
    return normalizarEncabezado_(header) === wanted;
  });

  if (index < 0) throw new Error("Falta la columna " + name + ".");
  return index;
}

function indiceColumnaOpcional_(headers, name) {
  var wanted = normalizarEncabezado_(name);
  return headers.findIndex(function (header) {
    return normalizarEncabezado_(header) === wanted;
  });
}

function leerEncabezados_(sheet) {
  if (!sheet || sheet.getLastColumn() < 1) {
    throw new Error("La hoja no tiene encabezados.");
  }
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0];
}

function asegurarColumnaDisponibilidadCatalogo_(sheet) {
  var headers = leerEncabezados_(sheet);
  var availabilityCol = indiceColumnaOpcional_(headers, "Disponibilidad");
  if (availabilityCol < 0) {
    availabilityCol = headers.length;
    sheet.getRange(1, availabilityCol + 1).setValue("Disponibilidad");
    headers.push("Disponibilidad");
  }

  var lastRow = sheet.getLastRow();
  if (lastRow >= 2) {
    var range = sheet.getRange(2, availabilityCol + 1, lastRow - 1, 1);
    var values = range.getValues();
    var hasEmptyValues = false;
    values = values.map(function (row) {
      if (String(row[0] || "").trim()) return row;
      hasEmptyValues = true;
      return ["Disponible"];
    });
    if (hasEmptyValues) range.setValues(values);
  }
  return headers;
}

function tieneEncabezadosCatalogo_(sheet) {
  if (!sheet || sheet.getLastColumn() < 1) return false;
  var headers = leerEncabezados_(sheet).map(normalizarEncabezado_);
  return [
    "producto", "precioventa", "imageurl", "id", "categoria",
    "descripcion", "activo", "idvendedor"
  ].every(function (header) {
    return headers.indexOf(header) >= 0;
  });
}

function esHojaCatalogo_(sheet) {
  return Boolean(sheet) &&
    (sheet.getName() === "Catalogo" || tieneEncabezadosCatalogo_(sheet));
}

function obtenerHojaCatalogo_(spreadsheet) {
  var namedSheet = spreadsheet.getSheetByName("Catalogo");
  if (namedSheet && tieneEncabezadosCatalogo_(namedSheet)) return namedSheet;

  var matches = spreadsheet.getSheets().filter(tieneEncabezadosCatalogo_);
  if (matches.length === 1) return matches[0];
  if (matches.length > 1) {
    throw new Error("Hay varias hojas con encabezados de catálogo. Renombra una como Catalogo.");
  }
  throw new Error("No se encontró la hoja Catalogo ni una hoja con sus encabezados.");
}

function asignarCelda_(sheet, headers, rowNumber, headerName, value) {
  sheet.getRange(rowNumber, indiceColumna_(headers, headerName) + 1).setValue(value);
}

function extraerIdDrive_(value) {
  var text = String(value || "");
  var match = text.match(
    /\/d\/([A-Za-z0-9_-]{20,})|[?&]id=([A-Za-z0-9_-]{20,})/
  );
  return match ? (match[1] || match[2]) : "";
}

function referenciaImagen_(cell, rawValue) {
  return referenciasImagen_(cell, rawValue)[0] || "";
}

function referenciasImagen_(cell, rawValue) {
  return referenciasImagenDesdeRichText_(cell.getRichTextValue(), rawValue)
    .slice(0, MAX_FEATURED_PRODUCT_IMAGES);
}

function referenciasImagenDesdeRichText_(richText, rawValue) {
  var candidates = [];

  if (richText) {
    var directLink = richText.getLinkUrl();
    if (directLink) candidates.push(directLink);
    richText.getRuns().forEach(function (run) {
      var runLink = run.getLinkUrl();
      if (runLink) candidates.push(runLink);
    });
    candidates.push(richText.getText());
  }

  candidates.push(String(rawValue || ""));
  var references = [];
  for (var i = 0; i < candidates.length; i++) {
    String(candidates[i] || "").split(/[\n\r]+/).forEach(function (candidate) {
      var value = candidate.trim();
      if (!value) return;
      var driveId = extraerIdDrive_(value);
      if (driveId) {
        references.push("drive:" + driveId);
      } else if (/^drive:[A-Za-z0-9_-]{20,}$/.test(value)) {
        references.push(value);
      } else if (/^https?:\/\//i.test(value)) {
        references.push(value);
      }
    });
  }
  return references.filter(function (reference, index) {
    return references.indexOf(reference) === index;
  });
}

function convertirPrecio_(value) {
  if (typeof value === "number") return value;

  var text = String(value || "").trim().replace(/[^\d,.-]/g, "");
  if (!text) return 0;
  if (text.indexOf(",") >= 0) {
    text = text.replace(/\./g, "").replace(",", ".");
  }

  var price = Number(text);
  if (!Number.isFinite(price)) {
    throw new Error("Hay un precio no válido en Catalogo.");
  }
  return price;
}

function obtenerMapaVendedores_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("VENDEDORES_MKP");
  var map = {};
  if (!sheet || sheet.getLastRow() < 2) return map;

  var headers = leerEncabezados_(sheet);
  var rows = sheet
    .getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn())
    .getValues();
  var idCol = indiceColumna_(headers, "ID_Vendedor");
  var nameCol = indiceColumna_(headers, "Nombre");
  var phoneCol = indiceColumna_(headers, "WhatsApp");
  var activeCol = indiceColumna_(headers, "Activo");
  var planCol = indiceColumna_(headers, "Plan");
  var paymentCol = indiceColumna_(headers, "Estado_pago");
  var featuredStateCol = indiceColumna_(headers, "Estado_Destaque");
  var featuredEndCol = indiceColumna_(headers, "Fecha_Fin_Destaque");
  var featuredProductCol = indiceColumna_(headers, "ID_Producto_Destacado");
  var now = Date.now();

  rows.forEach(function (row) {
    var active = String(row[activeCol] || "").trim().toLowerCase();
    var plan = String(row[planCol] || "").trim();
    var payment = String(row[paymentCol] || "").trim().toLowerCase();
    var isActive = ["si", "sí", "true", "activo"].indexOf(active) >= 0;
    var isPaidOrFreeApproved =
      payment === "aprobado" ||
      (plan === "Freemium" && payment === "no_requerido");

    map[String(row[idCol])] = {
      approved: isActive && isPaidOrFreeApproved,
      name: String(row[nameCol] || ""),
      whatsapp: String(row[phoneCol] || "").replace(/\D/g, ""),
      featured: String(row[featuredStateCol] || "").trim().toLowerCase() === "activo" &&
        row[featuredEndCol] instanceof Date &&
        row[featuredEndCol].getTime() > now,
      featuredProductId: String(row[featuredProductCol] || "").trim()
    };
  });

  return map;
}

function obtenerProductosPublicos_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = obtenerHojaCatalogo_(ss);

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  var headers = leerEncabezados_(sheet);
  var values = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
  var display = sheet.getRange(2, 1, lastRow - 1, headers.length).getDisplayValues();
  var col = {
    name: indiceColumna_(headers, "Producto"),
    price: indiceColumna_(headers, "Precio Venta"),
    image: indiceColumna_(headers, "Image_URL"),
    id: indiceColumna_(headers, "ID"),
    category: indiceColumna_(headers, "Categoria"),
    description: indiceColumna_(headers, "Descripcion"),
    sizes: indiceColumna_(headers, "Talles"),
    status: indiceColumna_(headers, "Activo"),
    sellerId: indiceColumna_(headers, "ID_Vendedor"),
    availability: indiceColumnaOpcional_(headers, "Disponibilidad"),
    uploadedAt: indiceColumnaOpcional_(headers, "Fecha_Subida")
  };
  var sellers = obtenerMapaVendedores_();
  var products = [];

  values.forEach(function (row, index) {
    var state = String(row[col.status] || "").trim().toLowerCase();
    if (["si", "sí", "activo", "activo_auto"].indexOf(state) < 0) return;

    var sellerId = String(row[col.sellerId] || "").trim();
    var seller = sellerId ? sellers[sellerId] : null;
    if (sellerId && seller && !seller.approved) return;

    var images = referenciasImagen_(
      sheet.getRange(index + 2, col.image + 1),
      row[col.image]
    );
    var sizesText = String(display[index][col.sizes] || "").trim();
    var product = {
      id: String(row[col.id]),
      name: String(row[col.name] || ""),
      price: convertirPrecio_(row[col.price]),
      category: String(row[col.category] || "").trim().toLowerCase(),
      description: String(row[col.description] || ""),
      images: images,
      sizes: sizesText
        ? sizesText.split(/[,;\n]/).map(function (size) {
            return size.trim();
          }).filter(Boolean)
        : [],
      availability: normalizarDisponibilidadProducto_(
        col.availability >= 0 ? row[col.availability] : ""
      )
    };
    if (col.uploadedAt >= 0 && row[col.uploadedAt]) {
      var uploadedAt = row[col.uploadedAt] instanceof Date
        ? row[col.uploadedAt]
        : new Date(row[col.uploadedAt]);
      if (!isNaN(uploadedAt.getTime())) product.createdAt = uploadedAt.toISOString();
    }

    if (seller && seller.approved) {
      product.seller = { name: seller.name, whatsapp: seller.whatsapp };
      product.featured = seller.featured &&
        seller.featuredProductId === product.id;
    }
    products.push(product);
  });

  return products;
}

function obtenerCarpetaImagenesProducto_() {
  var properties = PropertiesService.getScriptProperties();
  var folderId = properties.getProperty("PRODUCT_IMAGES_FOLDER_ID");
  if (folderId) {
    var configuredFolder = DriveApp.getFolderById(folderId);
    if (configuredFolder.getName() !== "IMAGENES_PRODUCTOS" ||
        configuredFolder.getSharingAccess() !== DriveApp.Access.PRIVATE) {
      throw new Error("PRODUCT_IMAGES_FOLDER_ID no corresponde a IMAGENES_PRODUCTOS.");
    }
    return configuredFolder;
  }

  var folder = DriveApp.createFolder("IMAGENES_PRODUCTOS");
  properties.setProperty("PRODUCT_IMAGES_FOLDER_ID", folder.getId());
  return folder;
}

function nombreCarpetaSolicitud_(sellerId) {
  if (!/^[A-Za-z0-9_-]+$/.test(String(sellerId || ""))) {
    throw new Error("El ID del vendedor no es válido para preparar su carpeta.");
  }
  return "SOLICITUD_" + sellerId;
}

function obtenerCarpetaSolicitudVendedor_(sellerId, sellerEmail) {
  var root = obtenerCarpetaImagenesProducto_();
  var folderName = nombreCarpetaSolicitud_(sellerId);
  var folders = root.getFoldersByName(folderName);
  if (!folders.hasNext()) {
    throw new Error("La tienda debe preparar primero la carpeta de imágenes del vendedor.");
  }
  var folder = folders.next();
  if (folders.hasNext()) {
    throw new Error("Hay carpetas duplicadas para el vendedor " + sellerId + ".");
  }
  if (sellerEmail) {
    var hasSellerAccess = folder.getEditors().some(function (editor) {
      return editor.getEmail().trim().toLowerCase() === sellerEmail.trim().toLowerCase();
    });
    if (!hasSellerAccess) {
      throw new Error("La carpeta de propuestas no está habilitada para este correo. Contacta con la tienda.");
    }
  }
  return folder;
}

function prepararCarpetasFotosVendedores_() {
  var root = obtenerCarpetaImagenesProducto_();
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var sellers = spreadsheet.getSheetByName("VENDEDORES_MKP");
  if (!sellers || sellers.getLastRow() < 2) return;

  var headers = leerEncabezados_(sellers);
  var idCol = indiceColumna_(headers, "ID_Vendedor");
  var emailCol = indiceColumna_(headers, "Email");
  var rows = sellers.getRange(2, 1, sellers.getLastRow() - 1, headers.length).getValues();
  var ownerEmail = emailPropietario_();
  var approvedSellers = obtenerMapaVendedores_();
  rows.forEach(function (row) {
    var sellerId = String(row[idCol] || "").trim();
    var sellerEmail = normalizarEmailContacto_(row[emailCol]);
    if (!sellerId || !sellerEmail || !approvedSellers[sellerId] ||
        !approvedSellers[sellerId].approved) return;

    var folderName = nombreCarpetaSolicitud_(sellerId);
    var matches = root.getFoldersByName(folderName);
    var folder = matches.hasNext() ? matches.next() : root.createFolder(folderName);
    if (matches.hasNext()) {
      throw new Error("Hay carpetas duplicadas para el vendedor " + sellerId + ".");
    }
    var oldEditors = folder.getEditors().filter(function (editor) {
      return editor.getEmail().trim().toLowerCase() !== ownerEmail &&
        editor.getEmail().trim().toLowerCase() !== sellerEmail;
    });
    if (oldEditors.length) folder.removeEditors(oldEditors);
    var hasSellerAccess = folder.getEditors().some(function (editor) {
      return editor.getEmail().trim().toLowerCase() === sellerEmail;
    });
    if (!hasSellerAccess) folder.addEditor(sellerEmail);
  });
}

function subirImagenProducto(rowNumber, file) {
  var sheet = SpreadsheetApp.getActiveSheet();
  if (!esHojaCatalogo_(sheet) || !Number.isInteger(rowNumber) ||
      rowNumber < 2 || rowNumber > sheet.getLastRow()) {
    throw new Error("Selecciona un producto válido antes de cargar imágenes.");
  }
  var permission = permisoImagenProducto_(sheet, rowNumber);
  if (!file || typeof file.name !== "string" || typeof file.base64 !== "string") {
    throw new Error("El archivo seleccionado no es válido.");
  }
  if (PRODUCT_IMAGE_TYPES.indexOf(file.mimeType) < 0) {
    throw new Error("Usa una imagen JPG, PNG, GIF o WebP.");
  }
  if (file.base64.length > Math.ceil(MAX_PUBLIC_IMAGE_BYTES / 3) * 4 + 4) {
    throw validacionError_("Cada imagen debe pesar como máximo 5 MB.");
  }

  var bytes = Utilities.base64Decode(file.base64);
  if (!bytes.length || bytes.length > MAX_PUBLIC_IMAGE_BYTES) {
    throw validacionError_("Cada imagen debe pesar más de 0 y como máximo 5 MB.");
  }

  var safeName = file.name.replace(/[\u0000-\u001f\\/:*?"<>|]/g, "_").slice(0, 150) || "producto";
  if (/^\s*[=+\-@]/.test(safeName)) safeName = "_" + safeName;
  var blob = Utilities.newBlob(bytes, file.mimeType, safeName);
  var targetFolder = permission.role === "owner"
    ? obtenerCarpetaImagenesProducto_()
    : obtenerCarpetaSolicitudVendedor_(permission.sellerId, permission.email);
  var createdFile = targetFolder.createFile(blob);
  var uploadToken = Utilities.getUuid();
  CacheService.getUserCache().put(
    "product-image-upload:" + createdFile.getId(),
    uploadToken,
    1800
  );
  return { id: createdFile.getId(), name: createdFile.getName(), token: uploadToken };
}

function validarCargaImagen_(upload, folder) {
  if (!upload || typeof upload.id !== "string" ||
      !/^[A-Za-z0-9_-]{20,}$/.test(upload.id) ||
      typeof upload.token !== "string" ||
      CacheService.getUserCache().get("product-image-upload:" + upload.id) !== upload.token) {
    throw new Error("La carga de una imagen caducó o no pertenece a tu sesión. Vuelve a subirla.");
  }
  var file = DriveApp.getFileById(upload.id);
  var parents = file.getParents();
  var belongsToFolder = false;
  while (parents.hasNext()) {
    if (parents.next().getId() === folder.getId()) {
      belongsToFolder = true;
      break;
    }
  }
  if (!belongsToFolder || PRODUCT_IMAGE_TYPES.indexOf(file.getMimeType()) < 0 ||
      file.getSize() > MAX_PUBLIC_IMAGE_BYTES) {
    throw new Error("Una imagen no pertenece a la carpeta o no cumple los requisitos.");
  }
  return file;
}

function asociarImagenesProducto(rowNumber, imageUploads, replaceExisting) {
  var sheet = SpreadsheetApp.getActiveSheet();
  exigirPropietario_();
  if (!esHojaCatalogo_(sheet)) {
    throw new Error("La hoja activa ya no es la hoja del catálogo.");
  }
  if (!Number.isInteger(rowNumber) || rowNumber < 2 || rowNumber > sheet.getLastRow()) {
    throw new Error("La fila seleccionada ya no contiene un producto válido.");
  }
  var maxImages = maximoImagenesProducto_(sheet, rowNumber);
  if (!Array.isArray(imageUploads) || !imageUploads.length ||
      imageUploads.length > maxImages) {
    throw new Error("Este producto admite entre 1 y " + maxImages + " imágenes.");
  }

  var folder = obtenerCarpetaImagenesProducto_();
  var newReferences = imageUploads.map(function (upload) {
    var file = validarCargaImagen_(upload, folder);
    return { id: upload.id, token: upload.token, name: file.getName(), url: file.getUrl() };
  });

  var headers = leerEncabezados_(sheet);
  var imageCell = sheet.getRange(
    rowNumber,
    indiceColumna_(headers, "Image_URL") + 1
  );
  var existingReferences = replaceExisting
    ? []
    : referenciasImagen_(imageCell, imageCell.getValue()).map(function (reference) {
        if (reference.indexOf("drive:") === 0) {
          var existingFile = DriveApp.getFileById(reference.slice("drive:".length));
          return {
            id: reference.slice("drive:".length),
            name: existingFile.getName(),
            url: existingFile.getUrl()
          };
        }
        return { name: reference, url: reference };
      });
  var combined = existingReferences.concat(newReferences);
  if (combined.length > maxImages) {
    throw new Error(
      "Este producto ya tiene " + existingReferences.length +
      " imagen(es). Puedes tener hasta " + maxImages +
      "; selecciona menos fotos o elige reemplazarlas."
    );
  }

  var text = combined.map(function (image) { return image.name; }).join("\n");
  var richText = SpreadsheetApp.newRichTextValue().setText(text);
  var offset = 0;
  combined.forEach(function (image, index) {
    var end = offset + image.name.length;
    richText.setLinkUrl(offset, end, image.url);
    offset = end + (index < combined.length - 1 ? 1 : 0);
  });
  imageCell.setRichTextValue(richText.build());
  CacheService.getUserCache().removeAll(imageUploads.map(function (upload) {
    return "product-image-upload:" + upload.id;
  }));
  return { count: combined.length, added: newReferences.length };
}

function crearSolicitudCambioImagenes(rowNumber, justification, imageUploads) {
  var catalog = SpreadsheetApp.getActiveSheet();
  if (!esHojaCatalogo_(catalog) || !Number.isInteger(rowNumber) ||
      rowNumber < 2 || rowNumber > catalog.getLastRow()) {
    throw new Error("El producto seleccionado ya no es válido.");
  }
  var permission = permisoImagenProducto_(catalog, rowNumber);
  if (permission.role !== "seller") {
    throw new Error("La tienda principal puede actualizar las imágenes directamente.");
  }
  var reason = String(justification || "").trim();
  if (reason.length < 10 || reason.length > 1000) {
    throw new Error("Explica el motivo del cambio con entre 10 y 1000 caracteres.");
  }
  var maxImages = maximoImagenesProducto_(catalog, rowNumber);
  if (!Array.isArray(imageUploads) || !imageUploads.length ||
      imageUploads.length > maxImages) {
    throw new Error("Este producto admite entre 1 y " + maxImages + " imágenes propuestas.");
  }

  var folder = obtenerCarpetaImagenesProducto_();
  var sellerFolder = obtenerCarpetaSolicitudVendedor_(
    permission.sellerId,
    permission.email
  );
  var files = imageUploads.map(function (upload) {
    var file = validarCargaImagen_(upload, sellerFolder);
    return { id: upload.id, name: file.getName(), url: file.getUrl() };
  });
  var headers = leerEncabezados_(catalog);
  var productName = String(
    catalog.getRange(rowNumber, indiceColumna_(headers, "Producto") + 1).getDisplayValue() || ""
  ).trim();
  var productId = String(
    catalog.getRange(rowNumber, indiceColumna_(headers, "ID") + 1).getValue() || ""
  ).trim();
  if (!productName || !productId) {
    throw new Error("El producto necesita nombre e ID para registrar la solicitud.");
  }

  var lock = LockService.getDocumentLock();
  lock.waitLock(30000);
  try {
    var requests = hojaSolicitudesImagenes_(SpreadsheetApp.getActiveSpreadsheet());
    var requestRow = requests.getLastRow() + 1;
    requests.getRange(requestRow, 1, 1, 12).setValues([[
      new Date(),
      productId,
      neutralizarFormula_(productName),
      files.map(function (file) { return file.id; }).join("\n"),
      files.map(function (file) { return neutralizarFormula_(file.name); }).join("\n"),
      permission.sellerId,
      neutralizarFormula_(permission.email),
      neutralizarFormula_(reason),
      "Pendiente",
      rowNumber,
      "",
      ""
    ]]);
    var text = files.map(function (file) { return file.name; }).join("\n");
    var richText = SpreadsheetApp.newRichTextValue().setText(text);
    var offset = 0;
    files.forEach(function (file, index) {
      var end = offset + file.name.length;
      richText.setLinkUrl(offset, end, file.url);
      offset = end + (index < files.length - 1 ? 1 : 0);
    });
    requests.getRange(requestRow, 5).setRichTextValue(richText.build());
  } finally {
    lock.releaseLock();
  }

  CacheService.getUserCache().removeAll(imageUploads.map(function (upload) {
    return "product-image-upload:" + upload.id;
  }));
  return { status: "Pendiente", count: files.length };
}

function eliminarImagenesCarga(rowNumber, imageUploads) {
  if (!Array.isArray(imageUploads) || !imageUploads.length) return;
  var sheet = SpreadsheetApp.getActiveSheet();
  if (!esHojaCatalogo_(sheet)) throw new Error("No se encontró la hoja del producto.");
  var permission = permisoImagenProducto_(sheet, rowNumber);
  var folder = permission.role === "owner"
    ? obtenerCarpetaImagenesProducto_()
    : obtenerCarpetaSolicitudVendedor_(permission.sellerId, permission.email);
  var cache = CacheService.getUserCache();
  imageUploads.forEach(function (upload) {
    var file = validarCargaImagen_(upload, folder);
    file.setTrashed(true);
    cache.remove("product-image-upload:" + upload.id);
  });
}

function obtenerImagenPublica_(imageId) {
  if (!/^[A-Za-z0-9_-]{20,}$/.test(imageId)) {
    throw validacionError_("Referencia de imagen no válida.");
  }

  var isPublishedProductImage = obtenerProductosPublicos_().some(function (product) {
    return product.images.indexOf("drive:" + imageId) >= 0;
  });
  if (!isPublishedProductImage) {
    throw validacionError_("La imagen no pertenece a un producto publicado.");
  }

  var file = DriveApp.getFileById(imageId);
  var mimeType = file.getMimeType();
  var allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
  if (allowedTypes.indexOf(mimeType) < 0) {
    throw validacionError_("El archivo no es un formato de imagen permitido.");
  }
  if (file.getSize() > MAX_PUBLIC_IMAGE_BYTES) {
    throw validacionError_("La imagen supera el límite de 5 MB.");
  }

  return {
    dataUrl: "data:" + mimeType + ";base64," +
      Utilities.base64Encode(file.getBlob().getBytes())
  };
}

function contarPlazasDestaque_(sheet, excludeSellerId) {
  if (sheet.getLastRow() < 2) return 0;

  var headers = leerEncabezados_(sheet);
  var rows = sheet
    .getRange(2, 1, sheet.getLastRow() - 1, headers.length)
    .getValues();
  var featuredCol = indiceColumna_(headers, "Destaque");
  var stateCol = indiceColumna_(headers, "Estado_Destaque");
  var deadlineCol = indiceColumna_(headers, "Fecha_Limite_Pago");
  var endCol = indiceColumna_(headers, "Fecha_Fin_Destaque");
  var sellerCol = indiceColumna_(headers, "ID_Vendedor");
  var now = Date.now();

  return rows.filter(function (row) {
    if (excludeSellerId && String(row[sellerCol]) === String(excludeSellerId)) {
      return false;
    }

    var option = String(row[featuredCol] || "").trim().toLowerCase();
    if (!option || option === "ninguno") return false;

    var state = String(row[stateCol] || "").trim().toLowerCase();
    var deadline = row[deadlineCol];
    var end = row[endCol];
    var pending = state === "pendiente_pago" &&
      (!(deadline instanceof Date) || deadline.getTime() > now);
    var active = state === "activo" &&
      (!(end instanceof Date) || end.getTime() > now);

    return pending || active;
  }).length;
}

function consultarDisponibilidadDestaque_() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName("VENDEDORES_MKP");
  if (!sheet) throw new Error("No se encontró la hoja VENDEDORES_MKP.");

  return {
    status: "success",
    disponible: contarPlazasDestaque_(sheet) < MAX_FEATURED_SELLERS
  };
}

function limiteRegistro_(name, fallback) {
  var configured = Number(PropertiesService.getScriptProperties().getProperty(name));
  return Number.isFinite(configured) && configured > 0
    ? Math.floor(configured)
    : fallback;
}

function verificarEmailDisponible_(sheet, email) {
  var normalizedEmail = normalizarEmailHoja_(email);
  var headers = leerEncabezados_(sheet);
  var emailCol = indiceColumna_(headers, "Email");
  var reviewCol = indiceColumna_(headers, "Estado_Revision");
  var paymentCol = indiceColumna_(headers, "Estado_pago");
  var cancellationCol = indiceColumna_(headers, "Fecha_Cancelacion");
  var rows = sheet.getLastRow() > 1
    ? sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).getValues()
    : [];
  var hasOpenRequest = rows.some(function (row) {
    if (normalizarEmailHoja_(row[emailCol]) !== normalizedEmail) return false;
    var review = String(row[reviewCol] || "").trim().toLowerCase();
    var payment = String(row[paymentCol] || "").trim().toLowerCase();
    var cancellation = row[cancellationCol];
    var isCancelled = cancellation instanceof Date
      ? !isNaN(cancellation.getTime())
      : String(cancellation || "").trim() !== "";
    return !isCancelled &&
      review !== "rechazado" &&
      payment !== "rechazado" &&
      payment !== "cancelado";
  });

  if (hasOpenRequest) {
    throw validacionError_("Ya existe una solicitud o cuenta abierta con este correo electrónico. Usa otro correo o contacta con la tienda.");
  }
}

function verificarLimiteRegistros_(sheet, email) {
  var normalizedEmail = normalizarEmailHoja_(email);
  var headers = leerEncabezados_(sheet);
  var emailCol = indiceColumna_(headers, "Email");
  var dateCol = indiceColumna_(headers, "Fecha_Registro");
  var rows = sheet.getLastRow() > 1
    ? sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).getValues()
    : [];
  var now = Date.now();
  var hour = 60 * 60 * 1000;
  var day = 24 * hour;
  var perEmail = 0;
  var lastHour = 0;

  rows.forEach(function (row) {
    var registeredAt = row[dateCol];
    if (!(registeredAt instanceof Date)) registeredAt = new Date(registeredAt);
    if (!(registeredAt instanceof Date) || isNaN(registeredAt.getTime())) return;
    var age = now - registeredAt.getTime();
    if (age < hour) lastHour++;
    if (age < day && normalizarEmailHoja_(row[emailCol]) === normalizedEmail) {
      perEmail++;
    }
  });

  if (perEmail >= limiteRegistro_("MAX_REGISTROS_POR_EMAIL", MAX_REGISTROS_POR_EMAIL)) {
    throw validacionError_("Se alcanzó el límite de solicitudes para este correo. Inténtalo más tarde.");
  }
  if (lastHour >= limiteRegistro_("MAX_REGISTROS_GLOBALES_HORA", MAX_REGISTROS_GLOBALES_HORA)) {
    throw validacionError_("Se alcanzó el límite de solicitudes por ahora. Inténtalo más tarde.");
  }
}

function registrarVendedor(datos) {
  datos = datos || {};
  if (String(datos.website || "").trim()) {
    return {
      idVendedor: "V-" + Utilities.getUuid(),
      emailEnviado: true,
      avisoTiendaEnviado: true,
      importe: 0
    };
  }
  var nombre = String(datos.nombre || "").trim();
  var whatsapp = String(datos.whatsapp || "").replace(/\D/g, "");
  var email = String(datos.email || "").trim().toLowerCase();
  var plan = String(datos.plan || "");
  var destaque = String(datos.destaque || "Ninguno");

  if (nombre.length < 2 || nombre.length > 100) {
    throw validacionError_("El nombre debe tener entre 2 y 100 caracteres.");
  }
  if (!/^\d{8,15}$/.test(whatsapp)) {
    throw validacionError_("El número de WhatsApp no es válido.");
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw validacionError_("El correo electrónico no es válido.");
  }
  if (!Object.prototype.hasOwnProperty.call(PLAN_PRICES, plan)) {
    throw validacionError_("El plan seleccionado no es válido.");
  }
  if (!Object.prototype.hasOwnProperty.call(FEATURED_PRICES, destaque)) {
    throw validacionError_("La opción de destaque no es válida.");
  }
  if (datos.consentimiento !== true) {
    throw validacionError_("Es necesario aceptar los términos y la política de privacidad.");
  }

  var importe = PLAN_PRICES[plan] + FEATURED_PRICES[destaque];
  var requiresPayment = importe > 0;
  var now = new Date();
  var paymentDeadline = requiresPayment
    ? new Date(now.getTime() + 24 * 60 * 60 * 1000)
    : "";
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("VENDEDORES_MKP");
  if (!sheet) throw new Error("No se encontró la hoja VENDEDORES_MKP.");

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);

  var sellerId = "V-" + Utilities.getUuid();
  var documentId = "";
  try {
    asegurarColumnasRevisionVendedor_(sheet);
    verificarEmailDisponible_(sheet, email);
    if (
      destaque !== "Ninguno" &&
      contarPlazasDestaque_(sheet) >= MAX_FEATURED_SELLERS
    ) {
      throw validacionError_("El cupo de destaques está completo.");
    }
    verificarLimiteRegistros_(sheet, email);

    documentId = guardarDocumentoDni_(sellerId, datos.documento);
    var headers = leerEncabezados_(sheet);
    var fields = {
      idvendedor: sellerId,
      nombre: neutralizarFormula_(nombre),
      whatsapp: whatsapp,
      email: neutralizarFormula_(email),
      activo: "no",
      consentimiento: "si",
      plan: plan,
      estadopago: requiresPayment ? "Pendiente_Pago" : "No_requerido",
      destaque: destaque,
      fecharegistro: now,
      idarchivodni: documentId,
      estadodestaque: destaque === "Ninguno" ? "Sin_destaque" : "Pendiente_Pago",
      fechalimitepago: paymentDeadline,
      fechapago: "",
      fechafindestaque: "",
      avisorenovacion: "",
      fechacancelacion: "",
      idproductodestacado: "",
      estadorevision: "Pendiente",
      fechabienvenida: ""
    };
    var row = headers.map(function (header) {
      var key = normalizarEncabezado_(header);
      if (!Object.prototype.hasOwnProperty.call(fields, key)) {
        throw new Error("Hay una columna no contemplada: " + header);
      }
      return fields[key];
    });
    sheet.appendRow(row);
  } catch (error) {
    if (documentId) {
      try {
        DriveApp.getFileById(documentId).setTrashed(true);
      } catch (cleanupError) {
        console.error("No se pudo retirar el documento tras el error de alta.", cleanupError);
      }
    }
    throw error;
  } finally {
    lock.releaseLock();
  }

  var emailSent = false;
  var subject = "Solicitud recibida — Percha&Co";
  var planLabel = etiquetaPlan_(plan);
  var featuredLabel = etiquetaDestaque_(destaque);
  var sellerIdSafe = escaparHtml_(sellerId);
  var nameSafe = escaparHtml_(nombre);
  var contactEmailSafe = escaparHtml_(STORE_CONTACT_EMAIL);
  var whatsappUrl = "https://wa.me/" + STORE_WHATSAPP_NUMBER +
    "?text=" + encodeURIComponent("Hola Percha&Co, escribo por mi solicitud " + sellerId + ".");
  var body;
  var emailIntro;
  var statusMessage;
  var detailRows = [
    ["Plan", planLabel],
    ["Destaque", featuredLabel],
    ["Total inicial", importe.toFixed(2).replace(".", ",") + " € (IVA incluido)"]
  ];

  if (requiresPayment) {
    detailRows.push(["Pagar por Bizum", BIZUM_PHONE_NUMBER]);
    body = "Hola " + nombre + ",\n\n" +
      "Recibimos tu solicitud. Aquí tienes el resumen:\n" +
      "Plan: " + planLabel + "\n" +
      "Destaque: " + featuredLabel + "\n" +
      "Total inicial: " + importe.toFixed(2).replace(".", ",") + " € (IVA incluido).\n\n" +
      "Envía el Bizum al número " + BIZUM_PHONE_NUMBER + " por el importe indicado. " +
      "La solicitud queda reservada durante 24 horas. Después, responde a este correo o " +
      "escríbenos por WhatsApp indicando tu ID de vendedor: " + sellerId + ".\n" +
      "La cuenta se activará al verificar el pago.";
    emailIntro = "Hemos recibido tu solicitud. Este es el resumen:";
    statusMessage = "Envía el Bizum al número " + BIZUM_PHONE_NUMBER + " por el importe indicado. " +
      "Tu solicitud queda reservada durante 24 horas. Después, responde a este correo o " +
      "escríbenos por WhatsApp indicando tu ID de vendedor. " +
      "La cuenta se activará al verificar el pago.";
  } else {
    body = "Hola " + nombre + ",\n\n" +
      "Recibimos tu solicitud. Plan: Freemium, sin destaque y sin coste.\n" +
      "Tu ID de vendedor es " + sellerId + ".\n\n" +
      "No tienes que hacer ningún pago. La tienda la revisará y, si no hay incidencias, " +
      "se aprobará automáticamente en un máximo de 48 horas.";
    emailIntro = "Hemos recibido tu solicitud para el plan Freemium.";
    statusMessage = "No tienes que hacer ningún pago. La tienda revisará tu solicitud y, si no hay incidencias, " +
      "se aprobará automáticamente en un máximo de 48 horas.";
  }

  var rowsHtml = detailRows.map(function (row) {
    return '<tr><td style="padding:10px 12px;border-bottom:1px solid #e5e9eb;color:#53636a;">' +
      escaparHtml_(row[0]) + '</td><td style="padding:10px 12px;border-bottom:1px solid #e5e9eb;' +
      'text-align:right;font-weight:600;color:#1b252a;">' +
      escaparHtml_(row[1]) + '</td></tr>';
  }).join("");
  var htmlBody = '<!doctype html><html lang="es"><body style="margin:0;padding:24px 12px;' +
    'background:#f3f5f6;font-family:Arial,Helvetica,sans-serif;color:#1b252a;">' +
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center">' +
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;' +
    'background:#ffffff;border:1px solid #d6dde0;border-radius:14px;overflow:hidden;">' +
    '<tr><td style="padding:22px 28px;background:#16424c;color:#ffffff;font-size:20px;font-weight:bold;">' +
    'Percha &amp; Co.</td></tr><tr><td style="padding:28px;">' +
    '<h1 style="margin:0 0 10px;font-size:24px;">Solicitud recibida</h1>' +
    '<p style="margin:0 0 20px;color:#53636a;">Hola ' + nameSafe + '. ' +
    escaparHtml_(emailIntro) + '</p>' +
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;' +
    'background:#f8fafb;border:1px solid #e5e9eb;border-radius:8px;">' + rowsHtml + '</table>' +
    '<p style="margin:20px 0 6px;color:#53636a;">Tu ID de vendedor</p>' +
    '<p style="margin:0;padding:12px;background:#eef4f5;border-radius:8px;font-family:monospace;' +
    'font-size:15px;overflow-wrap:anywhere;">' + sellerIdSafe + '</p>' +
    '<p style="margin:20px 0;color:#53636a;line-height:1.6;">' +
    escaparHtml_(statusMessage) + '</p>' +
    '<p style="margin:0 0 10px;font-weight:bold;">¿Necesitas ayuda?</p>' +
    '<p style="margin:0 0 18px;color:#53636a;">Escríbenos a ' +
    '<a href="mailto:' + contactEmailSafe + '" style="color:#16424c;">' +
    contactEmailSafe + '</a> o contáctanos por WhatsApp.</p>' +
    '<a href="' + escaparHtml_(whatsappUrl) + '" style="display:inline-block;padding:12px 18px;' +
    'border-radius:8px;background:#138045;color:#ffffff;text-decoration:none;font-weight:bold;">' +
    'Contactar por WhatsApp</a>' +
    '<p style="margin:24px 0 0;color:#7a878c;font-size:12px;">Percha &amp; Co.</p>' +
    '</td></tr></table></td></tr></table></body></html>';

  try {
    MailApp.sendEmail({
      to: email,
      subject: subject,
      body: body,
      htmlBody: htmlBody,
      name: "Percha&Co",
      replyTo: STORE_CONTACT_EMAIL
    });
    emailSent = true;
  } catch (mailError) {
    console.error("La solicitud se guardó, pero no se pudo enviar el correo.", mailError);
  }

  var storeNoticeSent = false;
  try {
    MailApp.sendEmail({
      to: STORE_CONTACT_EMAIL,
      subject: "Nueva solicitud de vendedor — Percha&Co",
      body: "Se recibió una nueva solicitud de vendedor.\n\n" +
        "Nombre: " + nombre + "\n" +
        "Correo: " + email + "\n" +
        "WhatsApp: " + whatsapp + "\n" +
        "Plan: " + planLabel + "\n" +
        "Destaque: " + featuredLabel + "\n" +
        "Importe inicial: " + importe.toFixed(2).replace(".", ",") + " €\n" +
        "ID de vendedor: " + sellerId + "\n\n" +
        "Revisa la solicitud en VENDEDORES_MKP. La cuenta no se activa hasta ser aprobada.",
      name: "Percha&Co",
      replyTo: STORE_CONTACT_EMAIL
    });
    storeNoticeSent = true;
  } catch (mailError) {
    console.error("La solicitud se guardó, pero no se pudo avisar a la tienda.", mailError);
  }

  return {
    idVendedor: sellerId,
    emailEnviado: emailSent,
    avisoTiendaEnviado: storeNoticeSent,
    importe: importe
  };
}

function guardarDocumentoDni_(sellerId, file) {
  var types = {
    "application/pdf": "pdf",
    "image/jpeg": "jpg",
    "image/png": "png"
  };
  if (!file || typeof file.base64 !== "string") {
    throw validacionError_("Falta el archivo del documento.");
  }

  var mimeType = String(file.mimeType || "").toLowerCase();
  if (!Object.prototype.hasOwnProperty.call(types, mimeType)) {
    throw validacionError_("Formato no permitido. Usa PDF, JPG o PNG.");
  }

  var base64 = file.base64.replace(/^data:[^;]+;base64,/i, "");
  if (
    !base64 ||
    base64.length > Math.ceil(MAX_ID_DOCUMENT_BYTES / 3) * 4 + 4 ||
    !/^[A-Za-z0-9+/]*={0,2}$/.test(base64)
  ) {
    throw validacionError_("El archivo supera el límite de 5 MB o no es válido.");
  }

  var bytes = Utilities.base64Decode(base64);
  if (!bytes.length || bytes.length > MAX_ID_DOCUMENT_BYTES) {
    throw validacionError_("El archivo supera el límite de 5 MB o está vacío.");
  }

  var first = bytes.slice(0, 8).map(function (byte) {
    return (byte + 256) % 256;
  });
  var signatureValid = false;
  if (mimeType === "application/pdf") {
    signatureValid =
      String.fromCharCode.apply(null, first.slice(0, 5)) === "%PDF-";
  } else if (mimeType === "image/jpeg") {
    signatureValid = first[0] === 255 && first[1] === 216 && first[2] === 255;
  } else if (mimeType === "image/png") {
    signatureValid = first.join(",") === "137,80,78,71,13,10,26,10";
  }
  if (!signatureValid) {
    throw validacionError_("El contenido del archivo no coincide con su formato.");
  }

  var folderId = PropertiesService.getScriptProperties().getProperty("DNI_FOLDER_ID");
  if (!folderId) throw new Error("Falta la propiedad DNI_FOLDER_ID.");

  var folder = DriveApp.getFolderById(folderId);
  if (
    folder.getName() !== "DNI_VENDEDORES" ||
    folder.getSharingAccess() !== DriveApp.Access.PRIVATE
  ) {
    throw new Error("La carpeta de documentos no existe o no está restringida.");
  }

  var blob = Utilities.newBlob(
    bytes,
    mimeType,
    "DNI_" + sellerId + "." + types[mimeType]
  );
  return folder.createFile(blob).getId();
}

function puedeSubirProducto(sellerId) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sellers = ss.getSheetByName("VENDEDORES_MKP");
  if (!sellers) throw new Error("Falta una hoja necesaria.");
  var catalog = obtenerHojaCatalogo_(ss);

  var sellerHeaders = leerEncabezados_(sellers);
  var sellerRows = sellers.getLastRow() > 1
    ? sellers.getRange(2, 1, sellers.getLastRow() - 1, sellerHeaders.length).getValues()
    : [];
  var seller = null;
  sellerRows.some(function (row) {
    if (String(row[indiceColumna_(sellerHeaders, "ID_Vendedor")]) === String(sellerId)) {
      seller = row;
      return true;
    }
    return false;
  });
  if (!seller) throw new Error("No se encontró el vendedor.");

  var active = String(seller[indiceColumna_(sellerHeaders, "Activo")]).toLowerCase();
  var payment = String(seller[indiceColumna_(sellerHeaders, "Estado_pago")]).toLowerCase();
  var isApproved = ["si", "sí", "true", "activo"].indexOf(active) >= 0 &&
    (payment === "aprobado" || payment === "no_requerido");
  if (!isApproved) return false;

  var plan = String(seller[indiceColumna_(sellerHeaders, "Plan")]);
  if (!Object.prototype.hasOwnProperty.call(PLAN_PRICES, plan)) {
    throw new Error("El plan del vendedor no es válido.");
  }
  var limit = plan === "Freemium" ? 5 : plan === "Plus" ? 10 : 20;

  var catalogHeaders = leerEncabezados_(catalog);
  var rows = catalog.getLastRow() > 1
    ? catalog.getRange(2, 1, catalog.getLastRow() - 1, catalogHeaders.length).getValues()
    : [];
  var sellerCol = indiceColumna_(catalogHeaders, "ID_Vendedor");
  var statusCol = indiceColumna_(catalogHeaders, "Activo");
  var count = rows.filter(function (row) {
    return String(row[sellerCol]) === String(sellerId) &&
      String(row[statusCol]).toLowerCase() !== "suspendido";
  }).length;

  return count < limit;
}

function aprobarProductosPendientes48Horas() {
  var sheet = obtenerHojaCatalogo_(SpreadsheetApp.getActiveSpreadsheet());
  if (sheet.getLastRow() < 2) return;

  var headers = leerEncabezados_(sheet);
  var statusCol = indiceColumna_(headers, "Activo");
  var dateCol = indiceColumna_(headers, "Fecha_Subida");
  var rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).getValues();
  var now = Date.now();

  rows.forEach(function (row, index) {
    var status = String(row[statusCol] || "").trim().toLowerCase();
    var uploadedAt = row[dateCol];
    if (
      status === "pendiente" &&
      uploadedAt instanceof Date &&
      now - uploadedAt.getTime() >= 48 * 60 * 60 * 1000
    ) {
      sheet.getRange(index + 2, statusCol + 1).setValue("Activo_Auto");
    }
  });
}

function aprobarVendedoresFreemium48Horas_() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("VENDEDORES_MKP");
  if (!sheet || sheet.getLastRow() < 2) return;

  var headers = asegurarColumnasRevisionVendedor_(sheet);
  var rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).getValues();
  var activeCol = indiceColumna_(headers, "Activo");
  var paymentCol = indiceColumna_(headers, "Estado_pago");
  var planCol = indiceColumna_(headers, "Plan");
  var registeredCol = indiceColumna_(headers, "Fecha_Registro");
  var reviewCol = indiceColumna_(headers, "Estado_Revision");
  var now = Date.now();

  rows.forEach(function (row, index) {
    var active = String(row[activeCol] || "").trim().toLowerCase();
    var payment = String(row[paymentCol] || "").trim().toLowerCase();
    if (
      ["si", "sí", "true", "activo"].indexOf(active) >= 0 ||
      payment !== "no_requerido" ||
      String(row[planCol] || "").trim() !== "Freemium" ||
      String(row[reviewCol] || "").trim().toLowerCase() !== "pendiente" ||
      !(row[registeredCol] instanceof Date) ||
      now - row[registeredCol].getTime() < 48 * 60 * 60 * 1000
    ) return;

    var rowNumber = index + 2;
    asignarCelda_(sheet, headers, rowNumber, "Estado_Revision", "Aprobado");
    asignarCelda_(sheet, headers, rowNumber, "Activo", "si");
    enviarBienvenidaVendedor_(sheet, headers, rowNumber);
  });
}

function enviarBienvenidasAprobados_() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("VENDEDORES_MKP");
  if (!sheet || sheet.getLastRow() < 2) return;

  var headers = asegurarColumnasRevisionVendedor_(sheet);
  var rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).getValues();
  var activeCol = indiceColumna_(headers, "Activo");
  var paymentCol = indiceColumna_(headers, "Estado_pago");
  var welcomeCol = indiceColumna_(headers, "Fecha_Bienvenida");
  rows.forEach(function (row, index) {
    var active = String(row[activeCol] || "").trim().toLowerCase();
    var payment = String(row[paymentCol] || "").trim().toLowerCase();
    if (
      ["si", "sí", "true", "activo"].indexOf(active) < 0 ||
      (payment !== "aprobado" && payment !== "no_requerido") ||
      row[welcomeCol]
    ) return;

    enviarBienvenidaVendedor_(sheet, headers, index + 2);
  });
}

function sumarSemanas_(date, weeks) {
  return new Date(date.getTime() + weeks * 7 * 24 * 60 * 60 * 1000);
}

function sumarMesMismoDia_(date) {
  var year = date.getFullYear();
  var month = date.getMonth() + 1;
  var day = date.getDate();
  var hours = date.getHours();
  var minutes = date.getMinutes();
  var seconds = date.getSeconds();
  var targetLastDay = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(day, targetLastDay), hours, minutes, seconds);
}

function fechaFinDestaque_(option, start) {
  var weeks = {
    "1_Semana": 1,
    "2_Semanas": 2,
    "3_Semanas": 3
  };
  if (weeks[option]) return sumarSemanas_(start, weeks[option]);
  if (option === "1_Mes") return sumarMesMismoDia_(start);
  throw new Error("La duración del destaque no es válida.");
}

function activarPagoVendedor_(sheet, headers, rowNumber) {
  var payment = String(
    sheet.getRange(rowNumber, indiceColumna_(headers, "Estado_pago") + 1).getValue() || ""
  ).trim().toLowerCase();
  if (payment !== "aprobado") return;
  headers = asegurarColumnasRevisionVendedor_(sheet);
  var review = String(
    sheet.getRange(rowNumber, indiceColumna_(headers, "Estado_Revision") + 1).getValue() || ""
  ).trim().toLowerCase();
  if (review === "rechazado") {
    throw new Error("No se puede activar una solicitud rechazada.");
  }

  var now = new Date();
  var featured = String(
    sheet.getRange(rowNumber, indiceColumna_(headers, "Destaque") + 1).getValue() || ""
  );
  var stateCol = indiceColumna_(headers, "Estado_Destaque") + 1;
  var featuredState = String(sheet.getRange(rowNumber, stateCol).getValue() || "").toLowerCase();
  if (featured !== "Ninguno" && featuredState !== "activo") {
    asignarCelda_(sheet, headers, rowNumber, "Fecha_Pago", now);
    asignarCelda_(sheet, headers, rowNumber, "Fecha_Fin_Destaque", fechaFinDestaque_(featured, now));
    asignarCelda_(sheet, headers, rowNumber, "Estado_Destaque", "Activo");
    asignarCelda_(sheet, headers, rowNumber, "Aviso_Renovacion", "");
  } else if (featured === "Ninguno") {
    asignarCelda_(sheet, headers, rowNumber, "Fecha_Pago", now);
    asignarCelda_(sheet, headers, rowNumber, "Estado_Destaque", "Sin_destaque");
  }
  asignarCelda_(sheet, headers, rowNumber, "Estado_Revision", "Aprobado");
  asignarCelda_(sheet, headers, rowNumber, "Activo", "si");
  limpiarAvisoRechazo_(sheet, headers, rowNumber);
  enviarBienvenidaVendedor_(sheet, headers, rowNumber);
}

function procesarEdicionInstalable(e) {
  if (!e || !e.range || e.range.getNumRows() !== 1 || e.range.getNumColumns() !== 1) return;

  var sheet = e.range.getSheet();
  var rowNumber = e.range.getRow();
  if (rowNumber < 2) return;
  var headers = leerEncabezados_(sheet);
  var editedColumn = e.range.getColumn() - 1;
  var now = new Date();

  if (sheet.getName() === "VENDEDORES_MKP") {
    headers = asegurarColumnasRevisionVendedor_(sheet);
    var paymentCol = indiceColumna_(headers, "Estado_pago");
    var activeCol = indiceColumna_(headers, "Activo");
    var reviewCol = indiceColumna_(headers, "Estado_Revision");

    if (editedColumn === reviewCol) {
      var review = String(e.range.getValue() || "").trim().toLowerCase();
      if (review === "rechazado") {
        asignarCelda_(sheet, headers, rowNumber, "Activo", "no");
        asignarCelda_(sheet, headers, rowNumber, "Estado_Destaque", "Cancelado");
        asignarCelda_(sheet, headers, rowNumber, "Fecha_Cancelacion", now);
        notificarRechazoVendedor_(
          sheet,
          headers,
          rowNumber,
          "La solicitud no cumple los requisitos de la tienda."
        );
      } else if (review === "aprobado") {
        var reviewPayment = String(
          sheet.getRange(rowNumber, paymentCol + 1).getValue() || ""
        ).trim().toLowerCase();
        if (reviewPayment === "no_requerido") {
          asignarCelda_(sheet, headers, rowNumber, "Activo", "si");
          limpiarAvisoRechazo_(sheet, headers, rowNumber);
          enviarBienvenidaVendedor_(sheet, headers, rowNumber);
        } else if (reviewPayment === "aprobado") {
          activarPagoVendedor_(sheet, headers, rowNumber);
        }
      }
    } else if (editedColumn === paymentCol) {
      var payment = String(e.range.getValue() || "").trim().toLowerCase();
      if (payment === "aprobado") {
        activarPagoVendedor_(sheet, headers, rowNumber);
      } else if (payment === "rechazado" || payment === "cancelado") {
        asignarCelda_(sheet, headers, rowNumber, "Activo", "no");
        asignarCelda_(sheet, headers, rowNumber, "Estado_Destaque", "Cancelado");
        var cancellation = sheet.getRange(
          rowNumber,
          indiceColumna_(headers, "Fecha_Cancelacion") + 1
        ).getValue();
        if (!(cancellation instanceof Date)) {
          asignarCelda_(sheet, headers, rowNumber, "Fecha_Cancelacion", now);
        }
        if (payment === "rechazado") {
          notificarRechazoVendedor_(
            sheet,
            headers,
            rowNumber,
            "El pago no fue validado."
          );
        } else {
          notificarRechazoVendedor_(
            sheet,
            headers,
            rowNumber,
            "La solicitud se canceló antes de completar el pago.",
            "Solicitud cancelada - Percha&Co",
            "Tu solicitud de vendedor en Percha&Co ha sido cancelada."
          );
        }
      }
    } else if (editedColumn === activeCol) {
      var active = String(e.range.getValue() || "").trim().toLowerCase();
      if (["si", "sí", "true", "activo"].indexOf(active) >= 0) {
        var paymentValue = String(
          sheet.getRange(rowNumber, paymentCol + 1).getValue() || ""
        ).trim().toLowerCase();
        var reviewValue = String(
          sheet.getRange(rowNumber, reviewCol + 1).getValue() || ""
        ).trim().toLowerCase();
        if (reviewValue === "rechazado") {
          throw new Error("No se puede activar una solicitud rechazada.");
        }
        if (paymentValue === "no_requerido") {
          asignarCelda_(sheet, headers, rowNumber, "Fecha_Pago", "");
        } else if (paymentValue !== "aprobado") {
          throw new Error("Solo se puede activar manualmente una cuenta Freemium sin pago.");
        }
        asignarCelda_(sheet, headers, rowNumber, "Estado_Revision", "Aprobado");
        limpiarAvisoRechazo_(sheet, headers, rowNumber);
        enviarBienvenidaVendedor_(sheet, headers, rowNumber);
      }
    }
    return;
  }

  if (!esHojaCatalogo_(sheet)) return;
  var productStatusCol = indiceColumna_(headers, "Activo");
  if (editedColumn !== productStatusCol) return;

  var status = String(e.range.getValue() || "").trim().toLowerCase();
  if (status !== "suspendido") {
    limpiarAvisoRechazo_(sheet, headers, rowNumber);
    return;
  }

  notificarRechazoProducto_(
    sheet,
    headers,
    rowNumber,
    "El producto no cumple los requisitos de la tienda."
  );
}

function obtenerEmailVendedor(spreadsheet, sellerId) {
  var sheet = spreadsheet.getSheetByName("VENDEDORES_MKP");
  if (!sheet || sheet.getLastRow() < 2) return "";
  var headers = leerEncabezados_(sheet);
  var rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).getValues();
  var idCol = indiceColumna_(headers, "ID_Vendedor");
  var emailCol = indiceColumna_(headers, "Email");

  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][idCol]) === String(sellerId)) {
      return normalizarEmailContacto_(rows[i][emailCol]);
    }
  }
  return "";
}

function procesarSolicitudesVencidas_() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("VENDEDORES_MKP");
  if (!sheet || sheet.getLastRow() < 2) return;
  var headers = asegurarColumnasRevisionVendedor_(sheet);
  var rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).getValues();
  var paymentCol = indiceColumna_(headers, "Estado_pago");
  var deadlineCol = indiceColumna_(headers, "Fecha_Limite_Pago");
  var now = new Date();

  rows.forEach(function (row, index) {
    var status = String(row[paymentCol] || "").trim().toLowerCase();
    var deadline = row[deadlineCol];
    if (
      status === "pendiente_pago" &&
      deadline instanceof Date &&
      deadline.getTime() <= now.getTime()
    ) {
      var rowNumber = index + 2;
      asignarCelda_(
        sheet,
        headers,
        rowNumber,
        "Motivo_Rechazo",
        "No se registró el pago dentro de las 24 horas. La plaza de destaque queda libre."
      );
      asignarCelda_(sheet, headers, rowNumber, "Estado_pago", "Cancelado");
      asignarCelda_(sheet, headers, rowNumber, "Activo", "no");
      asignarCelda_(sheet, headers, rowNumber, "Estado_Destaque", "Cancelado");
      asignarCelda_(sheet, headers, rowNumber, "Fecha_Cancelacion", now);
      notificarRechazoVendedor_(
        sheet,
        headers,
        rowNumber,
        "",
        "Solicitud cancelada - Percha&Co",
        "Tu solicitud de vendedor en Percha&Co ha sido cancelada."
      );
    }
  });
}

function procesarVencimientosDestaque_() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("VENDEDORES_MKP");
  if (!sheet || sheet.getLastRow() < 2) return;
  var headers = leerEncabezados_(sheet);
  var rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).getValues();
  var stateCol = indiceColumna_(headers, "Estado_Destaque");
  var endCol = indiceColumna_(headers, "Fecha_Fin_Destaque");
  var now = Date.now();

  rows.forEach(function (row, index) {
    if (
      String(row[stateCol] || "").trim().toLowerCase() === "activo" &&
      row[endCol] instanceof Date &&
      row[endCol].getTime() <= now
    ) {
      asignarCelda_(sheet, headers, index + 2, "Estado_Destaque", "Finalizado");
    }
  });
}

function enviarAvisosRenovacion_() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("VENDEDORES_MKP");
  if (!sheet || sheet.getLastRow() < 2) return;
  var headers = leerEncabezados_(sheet);
  var rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).getValues();
  var stateCol = indiceColumna_(headers, "Estado_Destaque");
  var endCol = indiceColumna_(headers, "Fecha_Fin_Destaque");
  var reminderCol = indiceColumna_(headers, "Aviso_Renovacion");
  var idCol = indiceColumna_(headers, "ID_Vendedor");
  var now = Date.now();

  rows.forEach(function (row, index) {
    var end = row[endCol];
    if (
      String(row[stateCol] || "").trim().toLowerCase() !== "activo" ||
      !(end instanceof Date) ||
      row[reminderCol] ||
      end.getTime() <= now ||
      end.getTime() - now > 7 * 24 * 60 * 60 * 1000
    ) return;

    var email = obtenerEmailVendedor(
      SpreadsheetApp.getActiveSpreadsheet(),
      row[idCol]
    );
    if (!email) return;

    MailApp.sendEmail(
      email,
      "Tu destaque está por finalizar — Percha&Co",
      "Tu período de destaque termina el " +
        Utilities.formatDate(end, Session.getScriptTimeZone(), "dd/MM/yyyy") +
        ". Puedes renovar por 1,99 € por semana adicional (IVA incluido). " +
        "Responde a este correo para coordinarlo; la renovación está sujeta al cupo disponible."
    );
    asignarCelda_(sheet, headers, index + 2, "Aviso_Renovacion", new Date());
  });
}

function borrarDocumentosCancelados_() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("VENDEDORES_MKP");
  if (!sheet || sheet.getLastRow() < 2) return;
  var headers = leerEncabezados_(sheet);
  var rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).getValues();
  var cancelledCol = indiceColumna_(headers, "Fecha_Cancelacion");
  var fileCol = indiceColumna_(headers, "ID_ARCHIVO_DNI");
  var now = Date.now();
  var retention = 30 * 24 * 60 * 60 * 1000;

  rows.forEach(function (row, index) {
    var cancelledAt = row[cancelledCol];
    var fileId = String(row[fileCol] || "");
    if (
      !fileId ||
      !(cancelledAt instanceof Date) ||
      now - cancelledAt.getTime() < retention
    ) return;

    DriveApp.getFileById(fileId).setTrashed(true);
    asignarCelda_(sheet, headers, index + 2, "ID_ARCHIVO_DNI", "");
  });
}

function idsImagenesCatalogo_() {
  var ids = {};
  var catalog = obtenerHojaCatalogo_(SpreadsheetApp.getActiveSpreadsheet());
  var lastRow = catalog.getLastRow();
  if (lastRow < 2) return ids;

  var headers = leerEncabezados_(catalog);
  var imageCol = indiceColumna_(headers, "Image_URL") + 1;
  var range = catalog.getRange(2, imageCol, lastRow - 1, 1);
  var richValues = range.getRichTextValues();
  var rawValues = range.getDisplayValues();
  richValues.forEach(function (row, index) {
    referenciasImagenDesdeRichText_(row[0], rawValues[index][0]).forEach(function (reference) {
      var id = reference.indexOf("drive:") === 0
        ? reference.slice("drive:".length)
        : extraerIdDrive_(reference);
      if (/^[A-Za-z0-9_-]{20,}$/.test(id)) ids[id] = true;
    });
  });
  return ids;
}

function idsPropuestasPendientes_() {
  var ids = {};
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("SOLICITUDES_CAMBIO_IMAGENES");
  if (!sheet || sheet.getLastRow() < 2) return ids;

  var headers = leerEncabezados_(sheet);
  var statusIndex = headers.findIndex(function (header) {
    return normalizarEncabezado_(header) === normalizarEncabezado_("Estado");
  });
  var idsIndex = headers.findIndex(function (header) {
    return normalizarEncabezado_(header) === normalizarEncabezado_("IDs_Propuestas");
  });
  if (statusIndex < 0 || idsIndex < 0) return ids;

  var rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).getValues();
  rows.forEach(function (row) {
    if (String(row[statusIndex] || "").trim().toLowerCase() !== "pendiente") return;
    String(row[idsIndex] || "").split(/[\n\r]+/).forEach(function (value) {
      var id = value.trim();
      if (/^[A-Za-z0-9_-]{20,}$/.test(id)) ids[id] = true;
    });
  });
  return ids;
}

function borrarImagenTemporalCaducada_(file, cutoff, protegidos) {
  if (!file || PRODUCT_IMAGE_TYPES.indexOf(file.getMimeType()) < 0) return false;
  var created = file.getDateCreated();
  if (!(created instanceof Date) || created.getTime() > cutoff) return false;
  if (protegidos[file.getId()]) return false;
  file.setTrashed(true);
  return true;
}

function limpiarCargasTemporalesAbandonadas() {
  var properties = PropertiesService.getScriptProperties();
  var hours = Number(properties.getProperty("TEMP_IMAGE_RETENTION_HOURS"));
  if (!Number.isFinite(hours) || hours <= 0) hours = 24;
  var cutoff = Date.now() - hours * 60 * 60 * 1000;
  var root = obtenerCarpetaImagenesProducto_();
  var protegidos = idsImagenesCatalogo_();
  var pending = idsPropuestasPendientes_();
  Object.keys(pending).forEach(function (id) {
    protegidos[id] = true;
  });

  var deleted = 0;
  var failed = 0;
  function borrar(file) {
    try {
      if (borrarImagenTemporalCaducada_(file, cutoff, protegidos)) deleted++;
    } catch (error) {
      failed++;
      console.error("No se pudo limpiar una imagen temporal " + file.getId() + ".", error);
    }
  }

  var rootFiles = root.getFiles();
  while (rootFiles.hasNext()) borrar(rootFiles.next());

  var folders = root.getFolders();
  while (folders.hasNext()) {
    var folder = folders.next();
    if (!/^SOLICITUD_/.test(folder.getName())) continue;
    var files = folder.getFiles();
    while (files.hasNext()) borrar(files.next());
  }

  console.log(
    "Limpieza de imágenes temporales: " + deleted + " eliminadas, " +
    failed + " con error."
  );
  return { deleted: deleted, failed: failed };
}

function procesarAutomatizacionesCadaHora() {
  aprobarProductosPendientes48Horas();
  aprobarVendedoresFreemium48Horas_();
  enviarBienvenidasAprobados_();
  procesarSolicitudesVencidas_();
  procesarVencimientosDestaque_();
  enviarAvisosRenovacion_();
  borrarDocumentosCancelados_();
  limpiarCargasTemporalesAbandonadas();
}

function configurarActivadoresPercha() {
  var handlers = ["procesarEdicionInstalable", "procesarAutomatizacionesCadaHora"];
  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    if (handlers.indexOf(trigger.getHandlerFunction()) >= 0) {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  ScriptApp.newTrigger("procesarEdicionInstalable")
    .forSpreadsheet(SpreadsheetApp.getActiveSpreadsheet())
    .onEdit()
    .create();
  ScriptApp.newTrigger("procesarAutomatizacionesCadaHora")
    .timeBased()
    .everyHours(1)
    .create();
}

function renovarDestaque(idVendedor, semanas) {
  semanas = Number(semanas);
  if (!Number.isInteger(semanas) || semanas < 1 || semanas > 4) {
    throw new Error("La renovación debe ser de 1 a 4 semanas.");
  }

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("VENDEDORES_MKP");
  if (!sheet) throw new Error("No se encontró la hoja VENDEDORES_MKP.");
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    var headers = leerEncabezados_(sheet);
    var rows = sheet.getLastRow() > 1
      ? sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).getValues()
      : [];
    var idCol = indiceColumna_(headers, "ID_Vendedor");
    var stateCol = indiceColumna_(headers, "Estado_Destaque");
    var endCol = indiceColumna_(headers, "Fecha_Fin_Destaque");
    var featuredCol = indiceColumna_(headers, "Destaque");
    var paymentCol = indiceColumna_(headers, "Estado_pago");
    var rowIndex = rows.findIndex(function (row) {
      return String(row[idCol]) === String(idVendedor);
    });
    if (rowIndex < 0) throw new Error("No se encontró el vendedor.");

    var rowNumber = rowIndex + 2;
    if (String(rows[rowIndex][featuredCol] || "") === "Ninguno") {
      throw new Error("El vendedor no contrató un destaque.");
    }
    if (String(rows[rowIndex][paymentCol] || "").toLowerCase() !== "aprobado") {
      throw new Error("Verifica el pago antes de renovar el destaque.");
    }
    var state = String(rows[rowIndex][stateCol] || "").toLowerCase();
    var end = rows[rowIndex][endCol];
    var start = state === "activo" && end instanceof Date && end > new Date()
      ? end
      : new Date();

    if (
      start.getTime() <= Date.now() &&
      contarPlazasDestaque_(sheet, idVendedor) >= MAX_FEATURED_SELLERS
    ) {
      throw validacionError_("El cupo de destaques está completo.");
    }

    asignarCelda_(sheet, headers, rowNumber, "Estado_Destaque", "Activo");
    asignarCelda_(sheet, headers, rowNumber, "Fecha_Fin_Destaque", sumarSemanas_(start, semanas));
    asignarCelda_(sheet, headers, rowNumber, "Aviso_Renovacion", "");
  } finally {
    lock.releaseLock();
  }
}

function verificarCarpetaDni() {
  var folderId = PropertiesService.getScriptProperties().getProperty("DNI_FOLDER_ID");
  if (!folderId) throw new Error("Falta la propiedad DNI_FOLDER_ID.");

  var folder = DriveApp.getFolderById(folderId);
  if (folder.getName() !== "DNI_VENDEDORES") {
    throw new Error("El ID configurado no corresponde a DNI_VENDEDORES.");
  }
  if (folder.getSharingAccess() !== DriveApp.Access.PRIVATE) {
    throw new Error("La carpeta debe tener acceso general restringido.");
  }
  Logger.log("Carpeta DNI encontrada y con acceso general restringido.");
}

function probarDisponibilidadDestaque() {
  var result = consultarDisponibilidadDestaque_();
  if (result.status !== "success" || typeof result.disponible !== "boolean") {
    throw new Error("La respuesta de disponibilidad no tiene el formato esperado.");
  }
  Logger.log(result.disponible ? "Hay cupo disponible." : "El cupo está completo.");
}

function probarCatalogoPublico() {
  var products = obtenerProductosPublicos_();
  if (!Array.isArray(products)) throw new Error("El catálogo no devolvió una lista.");
  Logger.log("Productos visibles: " + products.length);

  var driveImage = "";
  products.some(function (product) {
    driveImage = product.images.find(function (image) {
      return image.indexOf("drive:") === 0;
    }) || "";
    return Boolean(driveImage);
  });

  if (!driveImage) {
    Logger.log("No hay imágenes de Drive asociadas a productos visibles.");
    return;
  }

  var result = obtenerImagenPublica_(driveImage.slice("drive:".length));
  if (!result.dataUrl || result.dataUrl.indexOf("data:image/") !== 0) {
    throw new Error("No se pudo devolver la imagen del producto.");
  }
  Logger.log("Imagen de producto validada.");
}
