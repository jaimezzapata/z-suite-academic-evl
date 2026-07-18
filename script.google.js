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
      const match = name.match(/^(?:Semana|Sesion|Clase)\s+(\d{2})/i);
      const weekNumber = match ? parseInt(match[1], 10) : null;
      weeks.push({ weekNumber, folderName: name, folderId: folder.getId(), folderUrl: folder.getUrl() });
    }

    weeks.sort(function (a, b) {
      if (a.weekNumber === null && b.weekNumber === null) return 0;
      if (a.weekNumber === null) return 1;
      if (b.weekNumber === null) return -1;
      if (a.weekNumber !== b.weekNumber) return a.weekNumber - b.weekNumber;
      return String(a.folderName || "").localeCompare(String(b.folderName || ""));
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
    
    const rootFolderId = safeString(data.rootFolderId);
    const institution = safeString(data.institution).toUpperCase();
    const year = parseInt(data.year);
    const periodCode = safeString(data.periodCode).toUpperCase();
    const subjectName = safeString(data.subjectName);
    const cohortCode = safeString(data.cohortCode);
    const cesdeGroupTypeRaw = safeString(
      data.cesdeGroupType || data.groupType || data.group_type || data.modalidad || data.tipoGrupo
    );
    const cesdeGroupType = normalizarTipoGrupoCesde(cesdeGroupTypeRaw);
    const day1 = safeString(data.dayOfWeek1);
    const day2 = safeString(data.dayOfWeek2); 
    const jornada = safeString(data.jornada);
    const sede = safeString(data.sede);
    const startDateStr = safeString(data.startDate);
    const endDateStr = String(data.endDate ?? "").trim();

    const totalWeeks = (institution === "CESDE") ? 18 : 11;
    const daysText = day2 ? `${day1} y ${day2}` : day1;
    const isCesdeEmpresarial = institution === "CESDE" && esGrupoCesdeEmpresarial(cesdeGroupTypeRaw);

    if (!rootFolderId) throw new Error("Falta rootFolderId.");
    if (!institution) throw new Error("Falta institution.");
    if (!subjectName) throw new Error("Falta subjectName.");
    if (!cohortCode) throw new Error("Falta cohortCode.");
    if (!day1) throw new Error("Falta dayOfWeek1.");
    if (!startDateStr) throw new Error("Falta startDate.");

    let rootFolder;
    try {
      rootFolder = DriveApp.getFolderById(rootFolderId);
    } catch (err) {
      throw new Error("No se pudo acceder a la carpeta raíz. Verifica el ID.");
    }

    const instFolder = getOrCreateSubFolder(rootFolder, institution);
    const yearFolder = getOrCreateSubFolder(instFolder, year.toString());
    const periodFolder = getOrCreateSubFolder(yearFolder, periodCode);
    const modeFolder =
      institution === "CESDE"
        ? getOrCreateSubFolder(periodFolder, isCesdeEmpresarial ? "Empresarial" : "Regular")
        : periodFolder;

    const className = (institution === "SENA")
      ? `${cohortCode} - ${subjectName} (${daysText} - ${jornada} - ${sede})`
      : `${subjectName} - ${cohortCode} (${daysText} - ${jornada} - ${sede})`;
    
    const classFolder = modeFolder.createFolder(className);

    const privateFolder = classFolder.createFolder("01. Privada");
    const publicFolder = classFolder.createFolder(subjectName);
    publicFolder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    let currentDate = new Date(startDateStr + "T00:00:00");
    
    const easterSunday = calcularDomingoPascua(year);
    const holyMonday = new Date(easterSunday.getTime());
    holyMonday.setDate(easterSunday.getDate() - 6);

    const isFirstPeriod = (periodCode === "01" || periodCode === "T1");
    const weeksLog = [];

    if (isCesdeEmpresarial) {
      const sessionDates = obtenerFechasEmpresariales(startDateStr, endDateStr, day1, day2);
      if (!sessionDates.length) {
        throw new Error("No hay fechas válidas dentro del rango para los días seleccionados.");
      }

      for (let i = 0; i < sessionDates.length; i++) {
        const sessionDate = sessionDates[i];
        const sessionNumber = i + 1;
        const dateFormatted = Utilities.formatDate(sessionDate, Session.getScriptTimeZone(), "dd/MM/yyyy");
        const sessionFolderName = `Sesion ${sessionNumber < 10 ? '0' + sessionNumber : sessionNumber} (${dateFormatted})`;
        publicFolder.createFolder(sessionFolderName);
        weeksLog.push({ weekNumber: sessionNumber, folderName: sessionFolderName });
      }
    } else {
      for (let i = 1; i <= totalWeeks; i++) {
        
        if (isFirstPeriod && currentDate >= holyMonday && currentDate <= easterSunday) {
          currentDate.setDate(currentDate.getDate() + 7); 
        }

        let dateFormatted = Utilities.formatDate(currentDate, Session.getScriptTimeZone(), "dd/MM/yyyy");
        
        let milestoneText = "";
        if (institution === "CESDE") {
          if (i === 6 || i === 12 || i === 17) milestoneText = " - Recolección de evidencias";
        } else if (institution === "SENA") {
          if (i === 3) milestoneText = " - Entregable 1";
          else if (i === 6) milestoneText = " - Entregable 2";
          else if (i === 9) milestoneText = " - Entregable 3";
        }

        const weeklySessions = obtenerSesionesSemanales(currentDate, day1, day2);
        for (let sessionIndex = 0; sessionIndex < weeklySessions.length; sessionIndex++) {
          const sessionDate = weeklySessions[sessionIndex];
          dateFormatted = Utilities.formatDate(sessionDate, Session.getScriptTimeZone(), "dd/MM/yyyy");
          const weekLabel = `Semana ${i < 10 ? '0' + i : i}${milestoneText}`;
          const sessionDayLabel = capitalizarDiaSemana(nombreDiaSemanaDesdeFecha(sessionDate));
          const weekFolderName = day2
            ? `${weekLabel} - ${sessionDayLabel} (${dateFormatted})`
            : `${weekLabel} (${dateFormatted})`;

          publicFolder.createFolder(weekFolderName);
          weeksLog.push({ weekNumber: i, folderName: weekFolderName });
        }

        currentDate.setDate(currentDate.getDate() + 7);
      }
    }

return {
  status: "success",
  publicFolderId: publicFolder.getId(),
  publicFolderUrl: publicFolder.getUrl(),
  message: "¡Estructura académica creada con éxito!"
};

  } catch (error) {
    return { status: "error", message: error.toString() };
  } finally {
    lock.releaseLock();
  }
}


function getOrCreateSubFolder(parentFolder, folderName) {
  const subFolders = parentFolder.getFolders();
  while (subFolders.hasNext()) {
    let folder = subFolders.next();
    if (folder.getName() === folderName) return folder;
  }
  return parentFolder.createFolder(folderName);
}

function safeString(value) {
  return String(value || "").trim();
}

function normalizarTipoGrupoCesde(value) {
  return esGrupoCesdeEmpresarial(value) ? "EMPRESARIAL" : "REGULAR";
}

function esGrupoCesdeEmpresarial(value) {
  const normalized = normalizarDiaSemana(value);
  return normalized.indexOf("empresarial") !== -1;
}

function parseIsoDate(value) {
  const raw = String(value || "").trim();
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10) - 1;
  const day = parseInt(match[3], 10);
  return new Date(year, month, day);
}

function normalizarDiaSemana(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function diaSemanaToNumero(value) {
  const normalized = normalizarDiaSemana(value);
  const mapping = {
    domingo: 0,
    lunes: 1,
    martes: 2,
    miercoles: 3,
    jueves: 4,
    viernes: 5,
    sabado: 6,
  };
  return Object.prototype.hasOwnProperty.call(mapping, normalized) ? mapping[normalized] : null;
}

function obtenerFechasEmpresariales(startDateStr, endDateStr, day1, day2) {
  const startDate = parseIsoDate(startDateStr);
  const endDate = parseIsoDate(endDateStr);
  if (!startDate || !endDate) throw new Error("Las fechas de inicio y fin son obligatorias para CESDE empresarial.");
  if (endDate.getTime() < startDate.getTime()) throw new Error("La fecha de fin no puede ser menor que la fecha de inicio.");

  const allowedDays = {};
  const day1Number = diaSemanaToNumero(day1);
  if (day1Number === null) throw new Error("El primer día de clase no es válido.");
  allowedDays[day1Number] = true;

  if (day2) {
    const day2Number = diaSemanaToNumero(day2);
    if (day2Number === null) throw new Error("El segundo día de clase no es válido.");
    allowedDays[day2Number] = true;
  }

  const sessions = [];
  const current = new Date(startDate.getTime());
  current.setHours(0, 0, 0, 0);
  endDate.setHours(0, 0, 0, 0);

  while (current.getTime() <= endDate.getTime()) {
    if (allowedDays[current.getDay()]) {
      sessions.push(new Date(current.getTime()));
    }
    current.setDate(current.getDate() + 1);
  }

  return sessions;
}

function obtenerSesionesSemanales(anchorDate, day1, day2) {
  const start = new Date(anchorDate.getTime());
  start.setHours(0, 0, 0, 0);

  const allowedDays = {};
  const day1Number = diaSemanaToNumero(day1);
  if (day1Number === null) throw new Error("El primer día de clase no es válido.");
  allowedDays[day1Number] = true;

  if (day2) {
    const day2Number = diaSemanaToNumero(day2);
    if (day2Number === null) throw new Error("El segundo día de clase no es válido.");
    allowedDays[day2Number] = true;
  }

  const sessions = [];
  for (let offset = 0; offset < 7; offset++) {
    const current = new Date(start.getTime());
    current.setDate(start.getDate() + offset);
    if (allowedDays[current.getDay()]) {
      sessions.push(current);
    }
  }

  if (!sessions.length) {
    sessions.push(new Date(start.getTime()));
  }

  return sessions;
}

function nombreDiaSemanaDesdeFecha(date) {
  const labels = ["Domingo", "Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado"];
  return labels[date.getDay()] || "Dia";
}

function capitalizarDiaSemana(value) {
  const raw = String(value || "").trim();
  if (!raw) return "Dia";
  return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
}


function calcularDomingoPascua(year) {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1;
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month, day);
}
