/**
 * Z-SUITE - Lógica del Servidor (Reglas Institucionales Estrictas)
 */

function doGet() {
  return HtmlService.createTemplateFromFile('index')
    .evaluate()
    .setTitle('Z-SUITE - Automatización de Drive')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function doPost(e) {
  try {
    const contents = e && e.postData && e.postData.contents ? e.postData.contents : "";
    const body = contents ? JSON.parse(contents) : {};
    const data = body && typeof body === "object" && "data" in body ? body.data : body;
    const action = body && typeof body === "object" && "action" in body ? String(body.action ?? "") : "";
    const result = action === "getStructure" ? obtenerEstructuraDrive(data) : crearEstructuraDrive(data);
    return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function obtenerEstructuraDrive(data) {
  try {
    const publicFolderId = String(data.publicFolderId ?? "").trim();
    if (!publicFolderId) throw new Error("Falta publicFolderId");

    const publicFolder = DriveApp.getFolderById(publicFolderId);
    const parentIterator = publicFolder.getParents();
    const classFolder = parentIterator.hasNext() ? parentIterator.next() : null;
    if (!classFolder) throw new Error("No se pudo resolver la carpeta clase (padre de la pública)");

    let privateFolder = null;
    const subFolders = classFolder.getFolders();
    while (subFolders.hasNext()) {
      const folder = subFolders.next();
      if (folder.getName() === "01. Privada") privateFolder = folder;
    }

    const weeks = [];
    const weekFolders = publicFolder.getFolders();
    while (weekFolders.hasNext()) {
      const folder = weekFolders.next();
      const name = folder.getName();
      const match = name.match(/^Semana\s+(\d{2})/i);
      const weekNumber = match ? parseInt(match[1], 10) : null;
      weeks.push({ weekNumber, folderName: name, folderId: folder.getId(), folderUrl: folder.getUrl() });
    }

    weeks.sort(function (a, b) {
      if (a.weekNumber === null && b.weekNumber === null) return 0;
      if (a.weekNumber === null) return 1;
      if (b.weekNumber === null) return -1;
      return a.weekNumber - b.weekNumber;
    });

    return {
      status: "success",
      classFolder: { folderId: classFolder.getId(), folderUrl: classFolder.getUrl(), folderName: classFolder.getName() },
      publicFolder: { folderId: publicFolder.getId(), folderUrl: publicFolder.getUrl(), folderName: publicFolder.getName() },
      privateFolder: privateFolder
        ? { folderId: privateFolder.getId(), folderUrl: privateFolder.getUrl(), folderName: privateFolder.getName() }
        : null,
      weeks: weeks,
    };
  } catch (error) {
    return { status: "error", message: error.toString() };
  }
}

function crearEstructuraDrive(data) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    
    const rootFolderId = data.rootFolderId.trim();
    const institution = data.institution.toUpperCase();
    const year = parseInt(data.year);
    const periodCode = data.periodCode.toUpperCase();
    const subjectName = data.subjectName.trim();
    const cohortCode = data.cohortCode.trim();
    const day1 = data.dayOfWeek1.trim();
    const day2 = data.dayOfWeek2.trim(); // Puede venir vacío si es solo 1 día
    const jornada = data.jornada.trim();
    const sede = data.sede.trim();
    const startDateStr = data.startDate;

    const totalWeeks = (institution === "CESDE") ? 18 : 11;
    const daysText = day2 ? `${day1} y ${day2}` : day1;

    // 1. Acceder a la Carpeta Raíz
    let rootFolder;
    try {
      rootFolder = DriveApp.getFolderById(rootFolderId);
    } catch (err) {
      throw new Error("No se pudo acceder a la carpeta raíz. Verifica el ID.");
    }

    // 2. Jerarquía Principal
    const instFolder = getOrCreateSubFolder(rootFolder, institution);
    const yearFolder = getOrCreateSubFolder(instFolder, year.toString());
    const periodFolder = getOrCreateSubFolder(yearFolder, periodCode);

    // 3. Crear Clase
    const className = (institution === "SENA")
      ? `${cohortCode} - ${subjectName} (${daysText} - ${jornada} - ${sede})`
      : `${subjectName} - ${cohortCode} (${daysText} - ${jornada} - ${sede})`;
    
    const classFolder = periodFolder.createFolder(className);

    // 4. Privada y Pública (Ahora con el nombre de la materia)
    const privateFolder = classFolder.createFolder("01. Privada");
    const publicFolder = classFolder.createFolder(subjectName);
    publicFolder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    // 5. Motor de Fechas y Semanas (Standard +7 días)
    let currentDate = new Date(startDateStr + "T00:00:00");
    
    // Calcular Lunes Santo y Domingo de Resurrección para el año actual
    const easterSunday = calcularDomingoPascua(year);
    const holyMonday = new Date(easterSunday.getTime());
    holyMonday.setDate(easterSunday.getDate() - 6);

    const isFirstPeriod = (periodCode === "01" || periodCode === "T1");
    const weeksLog = [];

    for (let i = 1; i <= totalWeeks; i++) {
      
      // REGLA: Si es el primer periodo y la fecha cae en Semana Santa, saltamos esa semana
      if (isFirstPeriod && currentDate >= holyMonday && currentDate <= easterSunday) {
        currentDate.setDate(currentDate.getDate() + 7); // Añadimos 7 días de salto temporal
      }

      let dateFormatted = Utilities.formatDate(currentDate, Session.getScriptTimeZone(), "dd/MM/yyyy");
      
      let milestoneText = "";
      if (institution === "CESDE") {
        if (i === 6) milestoneText = " - Evidencia de Desempeño";
        else if (i === 12) milestoneText = " - Evidencia de Producto";
        else if (i === 17) milestoneText = " - Evidencia Final";
      } else if (institution === "SENA") {
        if (i === 3) milestoneText = " - Entregable 1";
        else if (i === 6) milestoneText = " - Entregable 2";
        else if (i === 9) milestoneText = " - Entregable 3";
      }

      let weekFolderName = `Semana ${i < 10 ? '0' + i : i}${milestoneText} (${dateFormatted})`;
      publicFolder.createFolder(weekFolderName);
      
      weeksLog.push({ weekNumber: i, folderName: weekFolderName });

      // Avanzar siempre 7 días constantes para la próxima semana
      currentDate.setDate(currentDate.getDate() + 7);
    }

return {
  status: "success",
  publicFolderId: publicFolder.getId(),
  publicFolderUrl: publicFolder.getUrl(),
  message: "¡Estructura académica de 18/11 semanas creada con éxito!"
};

  } catch (error) {
    return { status: "error", message: error.toString() };
  } finally {
    lock.releaseLock();
  }
}

// Helper: Buscar o crear carpeta
function getOrCreateSubFolder(parentFolder, folderName) {
  const subFolders = parentFolder.getFolders();
  while (subFolders.hasNext()) {
    let folder = subFolders.next();
    if (folder.getName() === folderName) return folder;
  }
  return parentFolder.createFolder(folderName);
}

// Helper: Algoritmo "Computus" para calcular el Domingo de Pascua (Semana Santa)
function calcularDomingoPascua(year) {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1; // 0 indexado para JS
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month, day);
}