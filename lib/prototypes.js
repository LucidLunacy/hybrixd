// (C) 2015 Internet of Coins / Metasync / Joachim de Koning
// hybridd - prototypes.js
// String prototypes providing global Javascript string functions

String.prototype.lTrim = function(charlist) {
  if (charlist === undefined) { charlist = "\s"; }
 
  return this.replace(new RegExp("^[" + charlist + "]+"), "");
};

String.prototype.rTrim = function(charlist) {
  if (charlist === undefined) { charlist = "\s"; }
 
  return this.replace(new RegExp("[" + charlist + "]+$"), "");
};

String.prototype.Trim = function(charlist) {
  return this.lTrim(charlist).rTrim(charlist);
};

String.prototype.Capitalize = function() {
    return this.charAt(0).toUpperCase() + this.slice(1);
};

String.prototype.hashCode = function() {
  var hash = 0, 
i, chr, len;
  if (this.length == 0) { return hash; }
  for (i = 0, len = this.length; i < len; i++) {
    chr = this.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0; // Convert to 32bit integer
  }
  return hash;
};

String.prototype.lZero = function(max) {
	var s = this;
    var z = max-s.length+1;
    z = z>1 ? Array(z).join("0") : "";
    return (z + s);     
};