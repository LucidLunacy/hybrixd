// Non-shared password validations
const C = commonUtils;

function validateUseridForLegacyWallets (userID) {
  var hxid = base32ToHex(userID).toUpperCase();
  var hxidSubStr = hxid.substr(12, 4);
  var hxidHash = DJB2.hash(hxid.substr(0, 12)).substr(0, 4);
  return hxidHash === hxidSubStr;
}

function validatePassForLegacyWallets (userID, pass) {
  var hxid = base32ToHex(userID).toLowerCase();
  var passwordUpperCase = pass.toUpperCase();
  var hxidSubStr = hxid.substr(16, 4).toUpperCase();
  var hxidHash = DJB2.hash(hxid.substr(0, 12) + passwordUpperCase).substr(4, 4);
  return hxidHash === hxidSubStr;
}

validations = {
  validateCredentials: function (userID, pass) {
    var isUserIDValid = C.validateUserIDLength(userID) && validateUseridForLegacyWallets(userID) && userID !== pass;
    var isPasswordValid = C.validatePasswordLength(pass) && validatePassForLegacyWallets(userID, pass);

    return isUserIDValid && isPasswordValid;
  }
};