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
var STORE_CONTACT_EMAIL = "patoog58@gmail.com";
var STORE_WHATSAPP_NUMBER = "34600369376";
var BIZUM_PHONE_NUMBER = "+34 600 369 376";

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
    console.error("Error en doGet:", error);
    return jsonOutput_({
      status: "error",
      message: error.message || String(error)
    });
  }
}

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      throw new Error("Falta el contenido de la solicitud.");
    }

    var data = JSON.parse(e.postData.contents);
    if (data.accion !== "registrarVendedor") {
      return jsonOutput_({ status: "error", message: "Acción no válida." });
    }

    var result = registrarVendedor(data);
    return jsonOutput_({
      status: "success",
      idVendedor: result.idVendedor,
      emailEnviado: result.emailEnviado,
      importe: result.importe
    });
  } catch (error) {
    console.error("Error en doPost:", error);
    return jsonOutput_({
      status: "error",
      message: error.message || String(error)
    });
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

function indiceColumna_(headers, name) {
  var wanted = normalizarEncabezado_(name);
  var index = headers.findIndex(function (header) {
    return normalizarEncabezado_(header) === wanted;
  });

  if (index < 0) throw new Error("Falta la columna " + name + ".");
  return index;
}

function leerEncabezados_(sheet) {
  if (!sheet || sheet.getLastColumn() < 1) {
    throw new Error("La hoja no tiene encabezados.");
  }
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0];
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
  var richText = cell.getRichTextValue();
  var candidates = [];

  if (richText) {
    var directLink = richText.getLinkUrl();
    if (directLink) candidates.push(directLink);
    richText.getRuns().forEach(function (run) {
      var runLink = run.getLinkUrl();
      if (runLink) candidates.push(runLink);
    });
  }

  candidates.push(String(rawValue || ""));

  for (var i = 0; i < candidates.length; i++) {
    var driveId = extraerIdDrive_(candidates[i]);
    if (driveId) return "drive:" + driveId;
  }

  var value = String(rawValue || "").trim();
  if (/^https?:\/\//i.test(value)) return value;
  if (/^drive:[A-Za-z0-9_-]{20,}$/.test(value)) return value;
  return "";
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
  var sheet = ss.getSheetByName("Catalogo");
  if (!sheet) throw new Error("No se encontró la hoja Catalogo.");

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
    sellerId: indiceColumna_(headers, "ID_Vendedor")
  };
  var sellers = obtenerMapaVendedores_();
  var products = [];

  values.forEach(function (row, index) {
    var state = String(row[col.status] || "").trim().toLowerCase();
    if (["si", "sí", "activo", "activo_auto"].indexOf(state) < 0) return;

    var sellerId = String(row[col.sellerId] || "").trim();
    var seller = sellerId ? sellers[sellerId] : null;
    if (sellerId && seller && !seller.approved) return;

    var image = referenciaImagen_(
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
      images: image ? [image] : [],
      sizes: sizesText
        ? sizesText.split(/[,;\n]/).map(function (size) {
            return size.trim();
          }).filter(Boolean)
        : []
    };

    if (seller && seller.approved) {
      product.seller = { name: seller.name, whatsapp: seller.whatsapp };
      product.featured = seller.featured &&
        seller.featuredProductId === product.id;
    }
    products.push(product);
  });

  return products;
}

function obtenerImagenPublica_(imageId) {
  if (!/^[A-Za-z0-9_-]{20,}$/.test(imageId)) {
    throw new Error("Referencia de imagen no válida.");
  }

  var isPublishedProductImage = obtenerProductosPublicos_().some(function (product) {
    return product.images.indexOf("drive:" + imageId) >= 0;
  });
  if (!isPublishedProductImage) {
    throw new Error("La imagen no pertenece a un producto publicado.");
  }

  var file = DriveApp.getFileById(imageId);
  var mimeType = file.getMimeType();
  var allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
  if (allowedTypes.indexOf(mimeType) < 0) {
    throw new Error("El archivo no es un formato de imagen permitido.");
  }
  if (file.getSize() > MAX_PUBLIC_IMAGE_BYTES) {
    throw new Error("La imagen supera el límite de 5 MB.");
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

function registrarVendedor(datos) {
  datos = datos || {};
  var nombre = String(datos.nombre || "").trim();
  var whatsapp = String(datos.whatsapp || "").replace(/\D/g, "");
  var email = String(datos.email || "").trim().toLowerCase();
  var plan = String(datos.plan || "");
  var destaque = String(datos.destaque || "Ninguno");

  if (nombre.length < 2 || nombre.length > 100) {
    throw new Error("El nombre debe tener entre 2 y 100 caracteres.");
  }
  if (!/^\d{8,15}$/.test(whatsapp)) {
    throw new Error("El número de WhatsApp no es válido.");
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("El correo electrónico no es válido.");
  }
  if (!Object.prototype.hasOwnProperty.call(PLAN_PRICES, plan)) {
    throw new Error("El plan seleccionado no es válido.");
  }
  if (!Object.prototype.hasOwnProperty.call(FEATURED_PRICES, destaque)) {
    throw new Error("La opción de destaque no es válida.");
  }
  if (datos.consentimiento !== true) {
    throw new Error("Es necesario aceptar los términos y la política de privacidad.");
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
    if (
      destaque !== "Ninguno" &&
      contarPlazasDestaque_(sheet) >= MAX_FEATURED_SELLERS
    ) {
      throw new Error("El cupo de destaques está completo.");
    }

    documentId = guardarDocumentoDni_(sellerId, datos.documento);
    var headers = leerEncabezados_(sheet);
    var fields = {
      idvendedor: sellerId,
      nombre: nombre,
      whatsapp: whatsapp,
      email: email,
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
      idproductodestacado: ""
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
      "La solicitud queda pendiente de revisión manual. No tienes que hacer ningún pago.";
    emailIntro = "Hemos recibido tu solicitud para el plan Freemium.";
    statusMessage = "Tu solicitud queda pendiente de revisión manual. No tienes que hacer ningún pago.";
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

  return { idVendedor: sellerId, emailEnviado: emailSent, importe: importe };
}

function guardarDocumentoDni_(sellerId, file) {
  var types = {
    "application/pdf": "pdf",
    "image/jpeg": "jpg",
    "image/png": "png"
  };
  if (!file || typeof file.base64 !== "string") {
    throw new Error("Falta el archivo del documento.");
  }

  var mimeType = String(file.mimeType || "").toLowerCase();
  if (!Object.prototype.hasOwnProperty.call(types, mimeType)) {
    throw new Error("Formato no permitido. Usa PDF, JPG o PNG.");
  }

  var base64 = file.base64.replace(/^data:[^;]+;base64,/i, "");
  if (
    !base64 ||
    base64.length > Math.ceil(MAX_ID_DOCUMENT_BYTES / 3) * 4 + 4 ||
    !/^[A-Za-z0-9+/]*={0,2}$/.test(base64)
  ) {
    throw new Error("El archivo supera el límite de 5 MB o no es válido.");
  }

  var bytes = Utilities.base64Decode(base64);
  if (!bytes.length || bytes.length > MAX_ID_DOCUMENT_BYTES) {
    throw new Error("El archivo supera el límite de 5 MB o está vacío.");
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
    throw new Error("El contenido del archivo no coincide con su formato.");
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
  var catalog = ss.getSheetByName("Catalogo");
  if (!sellers || !catalog) throw new Error("Falta una hoja necesaria.");

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
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Catalogo");
  if (!sheet) throw new Error("No se encontró la hoja Catalogo.");
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
  asignarCelda_(sheet, headers, rowNumber, "Activo", "si");
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
    var paymentCol = indiceColumna_(headers, "Estado_pago");
    var activeCol = indiceColumna_(headers, "Activo");

    if (editedColumn === paymentCol) {
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
      }
    } else if (editedColumn === activeCol) {
      var active = String(e.range.getValue() || "").trim().toLowerCase();
      if (["si", "sí", "true", "activo"].indexOf(active) >= 0) {
        var paymentValue = String(
          sheet.getRange(rowNumber, paymentCol + 1).getValue() || ""
        ).trim().toLowerCase();
        if (paymentValue === "no_requerido") {
          asignarCelda_(sheet, headers, rowNumber, "Fecha_Pago", "");
        } else if (paymentValue !== "aprobado") {
          throw new Error("Solo se puede activar manualmente una cuenta Freemium sin pago.");
        }
      }
    }
    return;
  }

  if (sheet.getName() !== "Catalogo") return;
  var productStatusCol = indiceColumna_(headers, "Activo");
  if (editedColumn !== productStatusCol) return;

  var status = String(e.range.getValue() || "").trim().toLowerCase();
  if (status !== "suspendido") return;

  var productName = sheet.getRange(
    rowNumber,
    indiceColumna_(headers, "Producto") + 1
  ).getValue();
  var sellerId = sheet.getRange(
    rowNumber,
    indiceColumna_(headers, "ID_Vendedor") + 1
  ).getValue();
  var email = obtenerEmailVendedor(e.source, sellerId);
  if (!email) return;

  MailApp.sendEmail(
    email,
    "Aviso: producto suspendido en Percha&Co",
    "Hola,\n\nEl producto '" + productName +
      "' fue suspendido tras una revisión. Si tienes consultas, responde a este correo.\n\n" +
      "El equipo de Percha&Co"
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
      return String(rows[i][emailCol] || "");
    }
  }
  return "";
}

function procesarSolicitudesVencidas_() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("VENDEDORES_MKP");
  if (!sheet || sheet.getLastRow() < 2) return;
  var headers = leerEncabezados_(sheet);
  var rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).getValues();
  var paymentCol = indiceColumna_(headers, "Estado_pago");
  var deadlineCol = indiceColumna_(headers, "Fecha_Limite_Pago");
  var cancellationCol = indiceColumna_(headers, "Fecha_Cancelacion");
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
      var sellerId = row[indiceColumna_(headers, "ID_Vendedor")];
      asignarCelda_(sheet, headers, rowNumber, "Estado_pago", "Cancelado");
      asignarCelda_(sheet, headers, rowNumber, "Activo", "no");
      asignarCelda_(sheet, headers, rowNumber, "Estado_Destaque", "Cancelado");
      asignarCelda_(sheet, headers, rowNumber, "Fecha_Cancelacion", now);
      var email = obtenerEmailVendedor(
        SpreadsheetApp.getActiveSpreadsheet(),
        sellerId
      );
      if (email) {
        try {
          MailApp.sendEmail(
            email,
            "Solicitud cancelada — Percha&Co",
            "Tu solicitud venció porque no se registró el pago dentro de las 24 horas. " +
              "La plaza de destaque queda libre. Si quieres volver a solicitar el alta, " +
              "puedes completar el formulario otra vez."
          );
        } catch (mailError) {
          console.error("No se pudo enviar el aviso de cancelación.", mailError);
        }
      }
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

function procesarAutomatizacionesCadaHora() {
  aprobarProductosPendientes48Horas();
  procesarSolicitudesVencidas_();
  procesarVencimientosDestaque_();
  enviarAvisosRenovacion_();
  borrarDocumentosCancelados_();
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
      throw new Error("El cupo de destaques está completo.");
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
