// hy_login.js - contains javascript for login, encryption and session authentication

$(document).ready(function() {

  var handleLogin = function handleLogin(clicked) {
		if ( ! clicked ) {
		  var userid = $('#inputUserID').val().toUpperCase();		
		  var passcode = $('#inputPasscode').val();
		  if ( userid.length == 16 && (passcode.length == 16 || passcode.length == 48) ) {
			  clicked = 1;
			  session_step = 0;
        $('#arc0').css('background-color',$('#combinator').css('color'));
        $('#generatebutton').attr('disabled','disabled');
        $('#helpbutton').attr('disabled','disabled');
        $('#combinatorwrap').css('opacity',1);
        rotate_login(0);
        setTimeout(function() { main( userid,passcode ); },1000);
      }
		}
  }  

  // handle login click
  var clicked = 0;
  $('#loginbutton').click( function() { handleLogin(clicked); });

  $('#inputUserID').keypress(function(e) {
    if (e.keyCode == 13) {
      $('#inputPasscode').focus();
    }
  });

  $('#inputPasscode').keypress(function(e) {
    if (e.keyCode == 13) {
      $('#loginbutton').focus();
      handleLogin(clicked);
    }
  });
  
  // for legacy wallets enable signin button on CTRL-S
  $(document).keydown(function(e) {

      var key = undefined;
      var possible = [ e.key, e.keyIdentifier, e.keyCode, e.which ];

      while (key === undefined && possible.length > 0)
      {
          key = possible.pop();
      }

      if (key && (key == '115' || key == '83' ) && (e.ctrlKey || e.metaKey) && !(e.altKey))
      {
          e.preventDefault();
          $('#loginbutton').removeAttr('disabled');
          return false;
      }
      return true;
  });

});

init.login = function(args) {
	//console.log('init.login called with args: '+JSON.stringify(args));	
	// do nothing	
}

function validate_userid(userid) {
  var hxid = base32ToHex(userid).toUpperCase();
  return (DJB2.hash(hxid.substr(0,12)).substr(0,4)==hxid.substr(12,4)?true:false); 
}

function validate_passwd(userid,passwd) {
  var hxid = base32ToHex(userid).toLowerCase();
  var entr = passwd.toUpperCase();
  return (DJB2.hash(hxid.substr(0,12)+entr).substr(4,4)==hxid.substr(16,4).toUpperCase()?true:false); 
}

function main(userid,passcode) {
	// instantiate nacl
	nacl = nacl_factory.instantiate();
  blink('arc0');
	var nonce = nacl.crypto_box_random_nonce();
	var user_keys = generate_keys(passcode,userid);

	var user_pubkey = nacl.to_hex(user_keys.boxPk);
	//DEBUG: console.log('user_pubkey:'+user_pubkey+'('+user_pubkey.length+')/nonce:'+nonce);
  do_login(user_keys,nonce);
	continue_session(user_keys,nonce,userid);
}

function next_step() {
  // function to prevent mis-stepping by concurrent step calls 
  var current_session = session_step;
  session_step++;
  return current_session+1;
}

function read_session(user_keys,nonce) {
	// decrypt session data (so that it does not lie around but is only 'known' upon decrypt)
	var sess_bin = nacl.from_hex($('#session_data').text());
  // user's session nonce is used for session_data	
  var session_data = nacl.crypto_box_open(sess_bin,nonce,user_keys.boxPk,user_keys.boxSk);
	var session_string = nacl.decode_utf8(session_data);
    
  return JSON.parse(session_string);
}

function continue_session(user_keys,nonce,userid) {
	var session_watch = $('#session_data').text();
	if ( session_watch == '' ) {
		setTimeout( function() { continue_session(user_keys,nonce,userid); }, 1000 );
	} else {
    // use read_session(user_keys,nonce) to read out session variables
		// DEBUG: console.log(read_session(user_keys,nonce));  // it works!
		// forward to the interface, session for the user starts
		setTimeout(function() { // added extra time to avoid forward to interface before x authentication completes!
			fetchview('interface',{'user_keys':user_keys,'nonce':nonce,'userid':userid});
		}, 3000 );
	}
}

function do_login(user_keys,nonce) {

	// post session_pubkey to server + receive server_pubkey back

	// generate random session_seed
	var session_seed = nacl.random_bytes(4096);
	// generate new session keypair	
	var session_keypair = nacl.crypto_box_keypair_from_seed(session_seed);
	// generate new session signpair
	var session_sign_seed = nacl.crypto_hash_sha256(session_seed);		
	var session_signpair = nacl.crypto_sign_keypair_from_seed(session_sign_seed);
	// convert nonce to hex representation for urlsafe transport
	var session_nonce = nacl.to_hex(nonce);
	// convert pubkeys to hex representation for urlsafe transport
	var session_hexkey = nacl.to_hex(session_keypair.boxPk);
	var session_hexsign = nacl.to_hex(session_signpair.signPk);
	// convert seckeys to hex for storage in key_array
	var session_seckey = nacl.to_hex(session_keypair.boxSk);
	var session_secsign = nacl.to_hex(session_signpair.signSk);

	//DEBUG console.log('session_seed:'+session_seed+'('+session_seed.length+')'); 	
	//DEBUG console.log('session_hexkey:'+session_hexkey+'('+session_hexkey.length+')'); 
	//DEBUG console.log('session_sign_seed:'+session_sign_seed+'('+session_sign_seed.length+')'); 
	//DEBUG console.log('session_hexsign:'+session_hexsign+'('+session_hexsign.length+')'); 
  
  dial_login(1);
	// posts to server under session pub key
	$.ajax({
		url: path+'x/'+session_hexsign+'/'+session_step,
		dataType: 'json'       
  })
  .done(function(data) {
    // receive nonce1 back
    if ( clean(data.nonce1).length == 48 )	{
      session_step++; // next step, hand out nonce	
	    var nonce2 = nacl.crypto_box_random_nonce();
	    var nonce2_hex = nacl.to_hex(nonce2);
	    // change first character to 1-6 if it is a-f to keep within 32 bytes 
	    var nonce2_hex = nonce2_hex.replace(/^[8-9a-f]/,function(match){var range=['8','9','a','b','c','d','e','f']; return range.indexOf(match);}); 				
	    var nonce1_hex = clean(data.nonce1);
	    var nonce1 = nacl.from_hex(nonce1_hex);
	    var nonce1_hex = nonce1_hex.replace(/^[8-9a-f]/,function(match){var range=['8','9','a','b','c','d','e','f']; return range.indexOf(match);}); 				
	    var secrets_json = { 'nonce1':nonce1_hex, 'nonce2':nonce2_hex, 'client_session_pubkey':session_hexkey };
	    var session_secrets = JSON.stringify(secrets_json);

	    // using signing method			
	    var crypt_bin = nacl.encode_utf8(session_secrets);			
	    var crypt_response = nacl.crypto_sign(crypt_bin,session_signpair.signSk);			
	    var crypt_hex = nacl.to_hex(crypt_response);

	    //DEBUG console.log('CR:'+crypt_hex);
	    $.ajax({
		    url: path+'x/'+session_hexsign+'/'+session_step+'/'+crypt_hex,	
		    dataType: 'json',  
      })
    	.done(function(data) {
        dial_login(2);
        // do something with the returning server_session_pubkey
        var server_sign_binkey = nacl.from_hex(clean(data.server_sign_pubkey));
        var crypt_bin = nacl.from_hex(clean(data.crhex));
        var crypt_pack = nacl.crypto_sign_open(crypt_bin,server_sign_binkey);
        var crypt_str = nacl.decode_utf8(crypt_pack);
        var crypt_vars = JSON.parse(crypt_str);
        //DEBUG console.log('PAYLOAD:'+JSON.stringify(crypt_str));
        if ( crypt_vars.server_sign_pubkey == data.server_sign_pubkey ) {
	        // TODO: make key array local scope?
	        var key_array = {'nonce':session_nonce,'nonce1':nonce1_hex,'nonce2':nonce2_hex,
	        'session_secsign':session_secsign,'session_seckey':session_seckey,
	        'session_pubsign':session_hexsign,'session_pubkey':session_hexkey,
	        'server_pubsign':crypt_vars.server_sign_pubkey,'server_pubkey':crypt_vars.server_session_pubkey};
	
	        var sess_bin = nacl.encode_utf8(JSON.stringify(key_array));			

	        //DEBUG: console.log('Raw session_data: '+JSON.stringify(key_array));

	        var sess_response = nacl.crypto_box(sess_bin,nonce,user_keys.boxPk,user_keys.boxSk);			
	        var sess_hex = nacl.to_hex(sess_response);
	        $('#session_data').text(sess_hex);
	        dial_login(3);					
        }
      });
    }					
  });
}

function generate_keys(secret,salt) {
	// normalise strings with stringtolower and stringtoupper
	//alert(secret.toUpperCase()+'/'+salt.toLowerCase());

	// Key Seed I
	// create bitArrays from secret and salt
	var secr_ba = sjcl.codec.utf8String.toBits(secret.toUpperCase());
	var salt_ba = sjcl.codec.utf8String.toBits(salt.toLowerCase());
	// use pbkdf2 to calculate key_seed (64 * 4 bytes = 256 bits = 32 bytes)
	var key_seed1 = sjcl.misc.pbkdf2(secr_ba,salt_ba,5000,4096,false);

	// Key Seed II
	// reverse secret upper case + upper case salt
	var rsecret = secret.toUpperCase().split("").reverse().join("");
	// create bitArrays from reverse secret 
	var rsecr_ba = sjcl.codec.utf8String.toBits(rsecret);
	var usalt_ba = sjcl.codec.utf8String.toBits(salt.toUpperCase());
	// use pbkdf2 to calculate key_seed (64 * 4 bytes = 256 bits = 32 bytes)
	var key_seed2 = sjcl.misc.pbkdf2(rsecr_ba,usalt_ba,5000,4096,false);

	// use two seeds to generate master key seed
	var key_seed3 = sjcl.misc.pbkdf2(key_seed1,key_seed2,5000,4096,false);	
	var key_seed_str3 = sjcl.codec.hex.fromBits(key_seed3);
	// DEBUG alert(key_seed_str3+'['+key_seed_str3.length+']');
	var final_key_seed = nacl.from_hex(key_seed_str3);
	
	// create user master key	
	var user_key = nacl.crypto_box_keypair_from_seed(final_key_seed);
  
  dial_login(0);
  
	return user_key;
}

function clean(dirty) {
	var dirty_str = dirty.toString();
	var clean_str = dirty_str.replace(/[^A-Za-z0-9]/g,'');
	return clean_str;
}