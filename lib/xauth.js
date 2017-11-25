// xauth.js -> implements secure connect exchange /x
//
// (c)2016 metasync r&d - Amadeus de Koning
//

// export every function
exports.xauth = xauth;
exports.xcrypt = xcrypt;
exports.xplain = xplain;

// DEPRECATED: import functions
// functions = require('./functions.js');
// hex2dec = require('./crypto/hex2dec.js');
// Decimal = require('./crypto/decimal-light.js');

// functions start here
function xauth(http_req,xpath) {
	var xresponse = {error:1};
  
	// authenticate and secure session communications
	var session_hexkey = xpath[1];
	var session_step = xpath[2];	
	var nonce1_rand = nacl.crypto_box_random_nonce();
	var nonce1_hex = nacl.to_hex(nonce1_rand);		// step 1. give nonce1 to user 
	if ( typeof global.hybridd.xauth.session[session_hexkey] == "undefined" && session_step == "0" ) { // no session defined	
		if ( session_hexkey.length == 64 ) {
			global.hybridd.xauth.session[session_hexkey] = {};
			global.hybridd.xauth.session[session_hexkey].nonce1 = nonce1_hex; 
			var sess_response = {error:0, nonce1:global.hybridd.xauth.session[session_hexkey].nonce1};
			xresponse = sess_response;
		}
	} 
	if ( typeof global.hybridd.xauth.session[session_hexkey].nonce1 != "undefined" && session_step == "1" ) {
		var payload = xpath[3];	// 3rd argument contains crypt_hex	
		// perform the first char lowering of the nonce1 (for sum purposes)
		global.hybridd.xauth.session[session_hexkey].nonce1 = global.hybridd.xauth.session[session_hexkey].nonce1.replace(/^[8-9a-f]/,function(match) { var range=["8","9","a","b","c","d","e","f"]; return range.indexOf(match); });
		// turn postdata back into array
		var clean_payload = functions.clean(payload);
		// decrypt crhex
		var crypt_bin = nacl.from_hex(clean_payload);
		// determine authenticity of pubkey by opening signed package
		var session_binkey = nacl.from_hex(session_hexkey);				
		var crypt_msg = nacl.crypto_sign_open(crypt_bin,session_binkey);
		// if user is authentic, create session keypair and store server_session_seckey in global
		if ( crypt_msg ) {
			var session_secrets = nacl.decode_utf8(crypt_msg);
			var secrets_json = JSON.parse(session_secrets);					
			// DEBUG console.log('Session secrets: '+session_secrets+' have_nonce:'+global.hybridd.xauth.session[session_hexkey].nonce1);
			global.hybridd.xauth.session[session_hexkey].nonce2 = functions.clean(secrets_json.nonce2);
			// check nonce1 sent with nonce1 stored
			if ( secrets_json.nonce1 == global.hybridd.xauth.session[session_hexkey].nonce1 ) {
				// create a server session keypair 
				// DEBUG console.log('This happens.');
				var server_session_seed = nacl.random_bytes(4096);
				var server_session_keypair = nacl.crypto_box_keypair_from_seed(server_session_seed);
				global.hybridd.xauth.session[session_hexkey].server_session_seckey = nacl.to_hex(server_session_keypair.boxSk);
				var server_session_pubkey = nacl.to_hex(server_session_keypair.boxPk);
				global.hybridd.xauth.session[session_hexkey].client_session_pubkey = secrets_json.client_session_pubkey;
				// create a server signing key
				var server_session_sign_seed = nacl.crypto_hash_sha256(server_session_seed);		
				var server_session_signpair = nacl.crypto_sign_keypair_from_seed(server_session_sign_seed);
				global.hybridd.xauth.session[session_hexkey].server_sign_seckey = nacl.to_hex(server_session_signpair.signSk);
				var server_sign_pubkey = nacl.to_hex(server_session_signpair.signPk);
				// prepare crypto packet variables (include server_sign_pubkey inside signed package for double check)
				var session_secrets = {server_sign_pubkey:server_sign_pubkey,server_session_pubkey:server_session_pubkey};
				// using signing method			
				var crypt_bin = nacl.encode_utf8(JSON.stringify(session_secrets));
				// DEBUG console.log('JSON crypt: '+JSON.stringify(session_secrets));			
				var crypt_response = nacl.crypto_sign(crypt_bin,server_session_signpair.signSk);			
				var crypt_hex = nacl.to_hex(crypt_response);
				// send server_session_pubhex encrypted with client_session_pubkey
				xresponse = {error:0,server_sign_pubkey:server_sign_pubkey,crhex:crypt_hex};
			} else {
				xresponse = {error:1};
			}
		}			
	}

	// return object to router for delivery
	return xresponse;
}


function xcrypt(session_hexkey,session_step,txtdata) {
	// used after xauth to communicate with client
	// decrypts the datagram sent to ychan
	// (mirrored for client in hybriddcall.js )

	if ( !global.hybridd.xauth.session[session_hexkey].invalid ) {
		if ( typeof global.hybridd.xauth.session[session_hexkey].server_session_seckey != "undefined" ) {
		  var server_sign_pubkey = global.hybridd.xauth.session[session_hexkey].server_session_pubsign;
      var client_session_pubkey = nacl.from_hex( global.hybridd.xauth.session[session_hexkey].client_session_pubkey );
      var server_session_seckey = nacl.from_hex( global.hybridd.xauth.session[session_hexkey].server_session_seckey );

        // calculate current session nonce from nonce1 + nonce2 + step
      var nonce1_dec = new Decimal(hex2dec.toDec(global.hybridd.xauth.session[session_hexkey].nonce1));
 		  var nonce2_dec = new Decimal(hex2dec.toDec(global.hybridd.xauth.session[session_hexkey].nonce2));
		  var step_dec = new Decimal(session_step);			    

		  // added using decimal-light plus function for looooong decimals
		  var nonce_constr = nonce1_dec.plus(nonce2_dec).plus(step_dec);
	    
		  // convert nonce_construct integer string back into hex
		  var nonce_convert = hex2dec.toHex(nonce_constr.toFixed(0).toString()); // Agent725 bugfix: cutoff disabled to ensure working nonce
		  var nonce_conhex = nonce_convert.substr(2,nonce_convert.length);

		  // DEBUG: console.log('Server side xcrypt nonce: '+nonce_conhex+' Txt data: '+txtdata);

		  var session_nonce = nacl.from_hex( nonce_conhex ); 			
			
		  var crypt_utf8 = nacl.encode_utf8(txtdata);
      
		  // example encoding using crypto_box (needs to be double checked for correct keys used and place of parameters)
		  var crypt_bin = nacl.crypto_box(crypt_utf8, session_nonce, client_session_pubkey, server_session_seckey);
		  var crypt_hex = nacl.to_hex(crypt_bin); // TODO: additional signing step against in-transport meddling acc. to nacl docs!!!		  // client already knows server_pubsign		  //return {error:0,crhex:crypt_hex}; 
		  return crypt_hex;
    }	
	}
}

function xplain(session_hexkey,session_step,encdata) {
	// decrypts the datagram sent to ychan 
	// (mirrored for client in hybriddcall.js )

	if ( !global.hybridd.xauth.session[session_hexkey].invalid ) {
		if ( typeof global.hybridd.xauth.session[session_hexkey].server_session_seckey != "undefined" ) {
			if(typeof encdata != "undefined" && encdata) {
				// get payload
				var clean_payload = functions.clean(encdata);
				var crypt_bin = nacl.from_hex(clean_payload);
				// get keys and nonce
				var client_session_pubkey = nacl.from_hex( global.hybridd.xauth.session[session_hexkey].client_session_pubkey );
				var server_session_seckey = nacl.from_hex( global.hybridd.xauth.session[session_hexkey].server_session_seckey );

				// calculate current session nonce from nonce1 + nonce2 + step
				var nonce1_dec = new Decimal(hex2dec.toDec(global.hybridd.xauth.session[session_hexkey].nonce1));
				var nonce2_dec = new Decimal(hex2dec.toDec(global.hybridd.xauth.session[session_hexkey].nonce2));
				var step_dec = new Decimal(session_step);			    

					// added using decimal-light plus function for looooong decimals
				var nonce_constr = nonce1_dec.plus(nonce2_dec).plus(step_dec);
			
				// convert nonce_construct integer string back into hex
				var nonce_convert = hex2dec.toHex(nonce_constr.toFixed(0).toString()); // Agent725 bugfix: cutoff disabled to ensure working nonce
				var nonce_conhex = nonce_convert.substr(2,nonce_convert.length);

				// DEBUG: console.log('Server side xplain nonce: '+nonce_conhex+' Enc data: '+encdata);

				var session_nonce = nacl.from_hex( nonce_conhex ); 			

				// example decoding using crypto_box
				// var crypt_msg = nacl.crypto_box_open(crypt_bin, nonceBin, senderPublicKeyBin, recipientSecretKeyBin);
				var decoded = nacl.crypto_box_open(crypt_bin, session_nonce, client_session_pubkey, server_session_seckey);
				var payload = nacl.decode_utf8(decoded);
				// DEBUG: console.log('DECRYPTED PAYLOAD >>>> '+payload);
			} else { payload = ""; }
			return payload;
		} 
    
    // TODO: dump connection and report IP + scrap key
    global.hybridd.xauth.session[session_hexkey].invalid = 1;
    // clean up
    setTimeout(function() {
      delete global.hybridd.xauth.session[session_hexkey];
    },3000);
		
	}
}

