const maxDays = 30;

async function genReportLog(container, key, url) {
  const response = await fetch("logs/" + key + "_report.log");
  let statusLines = "";
  if (response.ok) {
    statusLines = await response.text();
  }

  const normalized = normalizeData(statusLines);
  const statusStream = constructStatusStream(key, url, normalized);
  container.appendChild(statusStream);
}

function constructStatusStream(key, url, uptimeData) {
  let streamContainer = templatize("statusStreamContainerTemplate");
  for (var ii = maxDays - 1; ii >= 0; ii--) {
    let line = constructStatusLine(key, ii, uptimeData[ii]);
    streamContainer.appendChild(line);
  }

  const lastSet = uptimeData[0];
  const color = getColor(lastSet);

  const container = templatize("statusContainerTemplate", {
    title: key,
    url: url,
    color: color,
    status: getStatusText(color),
    upTime: uptimeData.upTime,
  });

  container.appendChild(streamContainer);
  return container;
}

function constructStatusLine(key, relDay, upTimeArray) {
  let date = new Date();
  date.setDate(date.getDate() - relDay);

  return constructStatusSquare(key, date, upTimeArray);
}

function getColor(uptimeVal) {
  return uptimeVal == null
    ? "nodata"
    : uptimeVal == 1
    ? "success"
    : uptimeVal < 0.3
    ? "failure"
    : "partial";
}

function constructStatusSquare(key, date, uptimeVal) {
  const color = getColor(uptimeVal);
  let square = templatize("statusSquareTemplate", {
    color: color,
    tooltip: getTooltip(key, date, color),
  });

  const show = () => {
    showTooltip(square, key, date, color);
  };
  square.addEventListener("mouseover", show);
  square.addEventListener("mousedown", show);
  square.addEventListener("mouseout", hideTooltip);
  return square;
}

let cloneId = 0;
function templatize(templateId, parameters) {
  let clone = document.getElementById(templateId).cloneNode(true);
  clone.id = "template_clone_" + cloneId++;
  if (!parameters) {
    return clone;
  }

  applyTemplateSubstitutions(clone, parameters);
  return clone;
}

function applyTemplateSubstitutions(node, parameters) {
  const attributes = node.getAttributeNames();
  for (var ii = 0; ii < attributes.length; ii++) {
    const attr = attributes[ii];
    const attrVal = node.getAttribute(attr);
    node.setAttribute(attr, templatizeString(attrVal, parameters));
  }

  if (node.childElementCount == 0) {
    node.innerText = templatizeString(node.innerText, parameters);
  } else {
    const children = Array.from(node.children);
    children.forEach((n) => {
      applyTemplateSubstitutions(n, parameters);
    });
  }
}

function templatizeString(text, parameters) {
  if (parameters) {
    for (const [key, val] of Object.entries(parameters)) {
      text = text.replaceAll("$" + key, val);
    }
  }
  return text;
}

function getStatusText(color) {
  return color == "nodata"
    ? "No Data Available"
    : color == "success"
    ? "Fully Operational"
    : color == "failure"
    ? "Major Outage"
    : color == "partial"
    ? "Partial Outage"
    : "Unknown";
}

function getStatusDescriptiveText(color) {
  return color == "nodata"
    ? "No Data Available: Health check was not performed."
    : color == "success"
    ? "No downtime recorded today."
    : color == "failure"
    ? "Major outages recorded today."
    : color == "partial"
    ? "Partial outages recorded today."
    : "Unknown";
}

function getTooltip(key, date, quartile, color) {
  let statusText = getStatusText(color);
  return `${key} | ${date.toDateString()} : ${quartile} : ${statusText}`;
}

function create(tag, className) {
  let element = document.createElement(tag);
  element.className = className;
  return element;
}

function normalizeData(statusLines) {
  const rows = statusLines.split("\n");
  const dateNormalized = splitRowsByDate(rows);

  let relativeDateMap = {};
  const now = Date.now();
  for (const [key, val] of Object.entries(dateNormalized)) {
    if (key == "upTime") {
      continue;
    }

    const relDays = getRelativeDays(now, new Date(key).getTime());
    relativeDateMap[relDays] = getDayAverage(val);
  }

  relativeDateMap.upTime = dateNormalized.upTime;
  return relativeDateMap;
}

function getDayAverage(val) {
  if (!val || val.length == 0) {
    return null;
  } else {
    return val.reduce((a, v) => a + v) / val.length;
  }
}

function getRelativeDays(date1, date2) {
  return Math.floor(Math.abs((date1 - date2) / (24 * 3600 * 1000)));
}

function splitRowsByDate(rows) {
  let dateValues = {};
  let sum = 0,
    count = 0;
  for (var ii = 0; ii < rows.length; ii++) {
    const row = rows[ii];
    if (!row) {
      continue;
    }

    const [dateTimeStr, resultStr] = row.split(",", 2);
    // Replace '-' with '/' because Safari
    const dateTime = new Date(
      Date.parse(dateTimeStr.replaceAll("-", "/") + " GMT")
    );
    const dateStr = dateTime.toDateString();

    let resultArray = dateValues[dateStr];
    if (!resultArray) {
      resultArray = [];
      dateValues[dateStr] = resultArray;
      if (dateValues.length > maxDays) {
        break;
      }
    }

    let result = 0;
    if (resultStr.trim() == "success") {
      result = 1;
    }
    sum += result;
    count++;

    resultArray.push(result);
  }

  const upTime = count ? ((sum / count) * 100).toFixed(2) + "%" : "--%";
  dateValues.upTime = upTime;
  return dateValues;
}

let tooltipTimeout = null;
function showTooltip(element, key, date, color) {
  clearTimeout(tooltipTimeout);
  const toolTipDiv = document.getElementById("tooltip");

  document.getElementById("tooltipDateTime").innerText = date.toDateString();
  document.getElementById("tooltipDescription").innerText =
    getStatusDescriptiveText(color);

  const statusDiv = document.getElementById("tooltipStatus");
  statusDiv.innerText = getStatusText(color);
  statusDiv.className = color;

  toolTipDiv.style.top = element.offsetTop + element.offsetHeight + 10;
  toolTipDiv.style.left =
    element.offsetLeft + element.offsetWidth / 2 - toolTipDiv.offsetWidth / 2;
  toolTipDiv.style.opacity = "1";
}

function hideTooltip() {
  tooltipTimeout = setTimeout(() => {
    const toolTipDiv = document.getElementById("tooltip");
    toolTipDiv.style.opacity = "0";
  }, 1000);
}

async function genAllReports() {
  const response = await fetch("urls.cfg");
  const configText = await response.text();
  const configLines = configText.split("\n");
  for (let ii = 0; ii < configLines.length; ii++) {
    const configLine = configLines[ii];
    const [key, url] = configLine.split("=");
    if (!key || !url) {
      continue;
    }

    const [cleanUrl] = url.split(" ");
    if (!cleanUrl) {
      continue;
    }

    await genReportLog(
      document.getElementById("reports"),
      key,
      cleanUrl.replaceAll('"', "")
    );
  }
}

async function genIncidentReport() {
  const response = await fetch(
    "https://incidents.statsig.workers.dev/contents"
  );
  if (response.ok) {
    const json = await response.json();

    const activeElement = document.getElementById("activeIncidentReports");
    const inactiveElement = document.getElementById("pastIncidentReports");
    
    try {
      const activeDom = DOMPurify.sanitize(marked.parse(json.active));

      const filteredInactive = filterIncidentsByDays(json.inactive, 30);
      const inactiveDom = DOMPurify.sanitize(marked.parse(filteredInactive));

      if (activeDom) {
        activeElement.innerHTML = activeDom;
        activeElement.classList.add("incidentReportsOrange");
        activeElement.classList.remove("incidentReportsGreen");
      } else {
        activeElement.innerHTML = "No active incidents";
        activeElement.classList.add("incidentReportsGreen");
        activeElement.classList.remove("incidentReportsOrange");
      }

      if (filteredInactive) {
        inactiveElement.innerHTML = inactiveDom;
        inactiveElement.classList.add("incidentReportsNeutral");
      } else {
        inactiveElement.innerHTML = "";
        inactiveElement.classList.remove("incidentReportsNeutral");
      }

      if (json.active) {
        setTimeout(() => {
          document.getElementById("incidents").scrollIntoView(true);
        }, 1000);
      }
    } catch (e) {
      console.log(e.message);
    }
  }
}

function filterIncidentsByDays(incidentMarkdown, days) {
  if (!incidentMarkdown) return "";
  
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  
  const incidents = incidentMarkdown.split(/(?=#### )/);
  const filteredIncidents = incidents.filter(incident => {
    if (!incident.trim()) return false;
    
    const dateMatch = incident.match(/#### (\d{1,2}\/\d{1,2}\/\d{4})/);
    if (!dateMatch) return false;
    
    const incidentDate = new Date(dateMatch[1]);
    return incidentDate >= cutoffDate;
  });
  
  return filteredIncidents.join('');
}

async function genIncidentHistory() {
  const response = await fetch(
    "https://incidents.statsig.workers.dev/contents"
  );
  if (response.ok) {
    const json = await response.json();
    try {
      const olderIncidents = filterIncidentsOlderThanDays(json.inactive, 30);
      const incidentsByYear = groupIncidentsByYear(olderIncidents);
      
      renderYearTabs(incidentsByYear);
      renderYearContent(incidentsByYear);
      
      const years = Object.keys(incidentsByYear).sort((a, b) => b - a);
      if (years.length > 0) {
        activateYear(years[0]);
      }
    } catch (e) {
      console.log(e.message);
    }
  }
}

function filterIncidentsOlderThanDays(incidentMarkdown, days) {
  if (!incidentMarkdown) return "";
  
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  
  const incidents = incidentMarkdown.split(/(?=#### )/);
  const olderIncidents = incidents.filter(incident => {
    if (!incident.trim()) return false;
    
    const dateMatch = incident.match(/#### (\d{1,2}\/\d{1,2}\/\d{4})/);
    if (!dateMatch) return false;
    
    const incidentDate = new Date(dateMatch[1]);
    return incidentDate < cutoffDate;
  });
  
  return olderIncidents.join('');
}

function groupIncidentsByYear(incidentMarkdown) {
  if (!incidentMarkdown) return {};
  
  const incidents = incidentMarkdown.split(/(?=#### )/).filter(i => i.trim());
  const incidentsByYear = {};
  
  incidents.forEach(incident => {
    const dateMatch = incident.match(/#### (\d{1,2}\/\d{1,2}\/\d{4})/);
    if (dateMatch) {
      const year = new Date(dateMatch[1]).getFullYear();
      if (!incidentsByYear[year]) {
        incidentsByYear[year] = [];
      }
      incidentsByYear[year].push(incident);
    }
  });
  
  return incidentsByYear;
}

function renderYearTabs(incidentsByYear) {
  const tabsContainer = document.getElementById("yearTabs");
  const years = Object.keys(incidentsByYear).sort((a, b) => b - a);
  
  tabsContainer.innerHTML = years.map(year => 
    `<div class="yearTab" data-year="${year}" onclick="activateYear('${year}')">${year}</div>`
  ).join('');
}

function renderYearContent(incidentsByYear) {
  const contentContainer = document.getElementById("yearContent");
  const years = Object.keys(incidentsByYear).sort((a, b) => b - a);
  
  contentContainer.innerHTML = years.map(year => {
    const yearIncidents = incidentsByYear[year].join('');
    const sanitizedContent = DOMPurify.sanitize(marked.parse(yearIncidents));
    return `<div class="yearSection" id="year-${year}">${sanitizedContent}</div>`;
  }).join('');
}

function activateYear(year) {
  document.querySelectorAll('.yearTab').forEach(tab => {
    tab.classList.remove('active');
  });
  document.querySelector(`[data-year="${year}"]`).classList.add('active');
  
  document.querySelectorAll('.yearSection').forEach(section => {
    section.classList.remove('active');
  });
  document.getElementById(`year-${year}`).classList.add('active');
}