// Returns the starting datetime of date (12 midnight in the same timezone).
function startOfDate(date) {
  var ret = new Date(date);
  ret.setHours(0,0,0,0);
  return ret;
}

// Returns the ending datetime of date (23:59:59.999 in the same timezone).
function endOfDate(date) {
  var ret = new Date(date);
  ret.setHours(23,59,59,999);
  return ret;
}

function today() {
  return new Date();
}

