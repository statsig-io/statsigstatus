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
  const colorClasses = getColorClasses(color);
  const title = key.replaceAll("_", " ").toUpperCase();

  const container = templatize("statusContainerTemplate", {
    title,
    url: url,
    "color-badge": colorClasses.badge,
    "color-dot": colorClasses.dot,
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

function getColorClasses(color) {
  const colorMap = {
    success: {
      badge: "bg-green-100 text-green-800",
      dot: "bg-green-500",
      square: "bg-green-500"
    },
    failure: {
      badge: "bg-red-100 text-red-800",
      dot: "bg-red-500",
      square: "bg-red-500"
    },
    partial: {
      badge: "bg-orange-100 text-orange-800",
      dot: "bg-orange-500",
      square: "bg-orange-500"
    },
    nodata: {
      badge: "bg-gray-100 text-gray-600",
      dot: "bg-gray-400",
      square: "bg-gray-300"
    }
  };
  return colorMap[color] || colorMap.nodata;
}

function constructStatusSquare(key, date, uptimeVal) {
  const color = getColor(uptimeVal);
  const colorClasses = getColorClasses(color);
  let square = templatize("statusSquareTemplate");

  // Add the background color class
  square.classList.add(colorClasses.square);
  square.setAttribute("data-status", color);

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

  // Process all child nodes, including text nodes
  const childNodes = Array.from(node.childNodes);
  childNodes.forEach((childNode) => {
    if (childNode.nodeType === Node.TEXT_NODE) {
      // Handle text nodes
      childNode.textContent = templatizeString(childNode.textContent, parameters);
    } else if (childNode.nodeType === Node.ELEMENT_NODE) {
      // Recursively handle element nodes
      applyTemplateSubstitutions(childNode, parameters);
    }
  });
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
    ? "Offline"
    : color == "success"
      ? "Online"
      : color == "failure"
        ? "Offline"
        : color == "partial"
          ? "Offline"
          : "Offline";
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
  const colorClasses = getColorClasses(color);

  document.getElementById("tooltipDateTime").innerText = date.toDateString();
  document.getElementById("tooltipDescription").innerText =
    getStatusDescriptiveText(color);

  const statusDiv = document.getElementById("tooltipStatus");
  statusDiv.innerText = getStatusText(color);
  statusDiv.className = `inline-flex items-center px-2 py-1 rounded-full text-xs font-medium mb-2 ${colorClasses.badge}`;

  // Position tooltip
  const rect = element.getBoundingClientRect();
  const tooltipRect = toolTipDiv.getBoundingClientRect();

  toolTipDiv.style.top = rect.bottom + window.scrollY + 10 + "px";
  toolTipDiv.style.left = Math.max(10, rect.left + window.scrollX + rect.width / 2 - tooltipRect.width / 2) + "px";
  toolTipDiv.classList.remove("opacity-0");
  toolTipDiv.classList.add("opacity-100");
}

function hideTooltip() {
  tooltipTimeout = setTimeout(() => {
    const toolTipDiv = document.getElementById("tooltip");
    toolTipDiv.classList.add("opacity-0");
    toolTipDiv.classList.remove("opacity-100");
  }, 1000);
}

function updateOverallStatus() {
  // Get all service containers
  const serviceContainers = document.querySelectorAll('#reports > div');
  let hasFailure = false;
  let hasPartial = false;
  let hasNoData = false;
  let hasSuccess = false;

  serviceContainers.forEach(container => {
    // Get the status stream container for this service
    const statusStream = container.querySelector('[id^="template_clone_"]');
    if (statusStream) {
      // Get all status squares and take the last one (most recent day)
      const statusSquares = statusStream.querySelectorAll('[data-status]');
      if (statusSquares.length > 0) {
        const mostRecentSquare = statusSquares[statusSquares.length - 1];
        const status = mostRecentSquare.getAttribute('data-status');
        if (status === 'failure') hasFailure = true;
        else if (status === 'partial') hasPartial = true;
        else if (status === 'nodata') hasNoData = true;
        else if (status === 'success') hasSuccess = true;
      }
    }
  });

  const overallStatusEl = document.getElementById('overall-status');

  // Clear and rebuild the content based on priority: failure > partial > nodata > success
  if (hasFailure) {
    overallStatusEl.className = 'inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800';
    overallStatusEl.innerHTML = '<div class="w-2 h-2 bg-red-500 rounded-full mr-2"></div>Major System Outage';
  } else if (hasPartial) {
    overallStatusEl.className = 'inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-orange-100 text-orange-800';
    overallStatusEl.innerHTML = '<div class="w-2 h-2 bg-orange-500 rounded-full mr-2"></div>Partial System Outage';
  } else if (hasNoData) {
    overallStatusEl.className = 'inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-600';
    overallStatusEl.innerHTML = '<div class="w-2 h-2 bg-gray-400 rounded-full mr-2"></div>System Status Unknown';
  } else if (hasSuccess) {
    overallStatusEl.className = 'inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800';
    overallStatusEl.innerHTML = '<div class="w-2 h-2 bg-green-500 rounded-full mr-2"></div>All Systems Operational';
  } else {
    // Fallback case if no services are found
    overallStatusEl.className = 'inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-600';
    overallStatusEl.innerHTML = '<div class="w-2 h-2 bg-gray-400 rounded-full mr-2"></div>Loading...';
  }
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

  // Update overall status after all reports are loaded
  setTimeout(updateOverallStatus, 1000);
}

async function genIncidentReport() {
  const response = await fetch(
    "incident_report.md"
  );
  if (response.ok) {
    const res = await response.text();
    try {
      const activeDom = DOMPurify.sanitize(
        marked.parse(res ? res : "No active incidents")
      );
      document.getElementById("newsUpdates").innerHTML = activeDom;
    } catch (e) {
      console.log(e.message);
    }
  }
}
