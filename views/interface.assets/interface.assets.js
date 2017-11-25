init.interface.assets = function(args) {
  topmenuset('assets');  // top menu UI change
  clearInterval(intervals); // clear all active intervals

  clipb_success = function() { 
    console.log('Data copied to clipboard.'); 
    $('#action-receive .copied').html('Address copied to clipboard.');
    $('#action-receive .copied').fadeTo( "fast" , 1);
    $('#action-receive .copied').delay(1000).fadeTo( "fast" , 0);
  };
  clipb_fail = function(err) {
    alert("This browser cannot automatically copy to the clipboard! \n\nPlease select the text manually, and press CTRL+C to \ncopy it to your clipboard.\n");
  };

  //
  // attached modal buttons and actions
  //
  
  $('#send-transfer').click(function() {
    if ($("#send-transfer").hasClass("disabled")) {
      // cannot send transaction
    } else {
      // send transfer
      var symbol = $('#action-send .modal-send-currency').attr('asset');
      sendTransaction({
        element:'.assets-main > .data .balance-'+symbol.replace(/\./g,'-'),
        asset:symbol,
        amount:Number($("#modal-send-amount").val().replace(/\,/g,'.')),
        source:String($('#action-send .modal-send-addressfrom').html()).trim(),
        target:String($('#modal-send-target').val()).trim()
      });
    }
  });

  $('#save-assetlist').click(function() {
    var array = [];
    for(var entry in GL.assetnames) {
      if(GL.assetSelect[entry]) {
        array.push(entry);
        init_asset(entry,GL.assetmodes[entry]);
      }
    }
    storage.Set( nacl.to_hex(GL.usercrypto.user_keys.boxPk)+'.assets.list.user' , JSON.stringify(array) );
    GL.assetsActive = array;
    displayAssets();
  });
  
  $('#search-assets').on('change keydown paste input', function(){
    var searchval = $('#search-assets').val();
    // delay the search by 1 second to avoid many multiple spawns of renderManageAssetsList
    setTimeout( function(searchval) {
      if(searchval === $('#search-assets').val()) {
        renderManageAssetsList(GL.assetnames,searchval);
      }
    },1000,searchval);
  });
  
  // modal helper functions
  manageAssets = function manageAssets() {
    renderManageAssetsList(GL.assetnames);
  }
  renderManageAssetsList = function renderManageAssetsList(list,search) {
    if(typeof search !== 'undefined') {
      search = search.toLowerCase();
    }
    GL.assetSelect = [];
    for(var entry in GL.assetnames) {
      if(GL.assetsActive.indexOf(entry) === -1) {
        GL.assetSelect[entry] = false;
      } else {
        GL.assetSelect[entry] = true;
      }
    }    
    var output = '<table class="pure-table pure-table-striped"><tbody>';
    var element;
    for (var entry in list) {
      if(typeof search === 'undefined' || entry.toLowerCase().indexOf(search) !== -1 || list[entry].toLowerCase().indexOf(search) !== -1 ) {
        element = entry.replace('.','-');
        output+='<tr><td class="icon">'+svg['circle']+'</td><td class="asset asset-btc">'+entry.toUpperCase()+'</td><td class="full-name">'+list[entry]+'</td>';
        output+='<td class="actions"><div class="assetbuttons assetbuttons-'+element+'">'+renderManageButton(element,(GL.assetSelect[entry]?1:0))+'</div></td></tr>';
      }
    }
    output+='</tbody></table>';
    $('#manage-assets .data').html(output); // insert new data into DOM
  }
  renderManageButton = function renderManageButton(asset,active) {
    return '<a onclick="changeManageButton(\''+asset+'\','+(active?0:1)+');" class="pure-button '+(active?'pure-button-error selectedAsset':'pure-button-success')+'" role="button"><div class="actions-icon">'+(active?svg['remove']:svg['add'])+'</div>'+(active?'Remove':'Add')+'</a>';
  }
  changeManageButton = function changeManageButton(asset,active) {
    if(active) {
      GL.assetSelect[asset] = true;
    } else {
      GL.assetSelect[asset] = false;
    }
    $('#manage-assets .assetbuttons-'+asset).html( renderManageButton(asset,active) );
  }
  
  fill_actions = function(asset,balance) {
    $('#action-actions #ModalLabel').html(asset.toUpperCase());
    $('#action-actions .balance').html(balance.toUpperCase());
    var output = '';
    output+='<a onclick=\'fill_send("'+asset+'","'+balance+'");\' href="#action-send" class="pure-button pure-button-primary" role="button" data-dismiss="modal" data-toggle="modal">Send</a>';
    output+='<a onclick=\'fill_recv("'+asset+'","'+balance+'");\' href="#action-receive" class="pure-button pure-button-secondary" role="button" data-dismiss="modal" data-toggle="modal">Receive</a>';
    output+='<a href="#action-advanced" class="pure-button pure-button-grey advanced-button" role="button" data-dismiss="modal" data-toggle="modal"><div class="advanced-icon">'+svg['advanced']+'</div>Advanced</a>';
    $('#action-actions .buttons').html(output); 
  }
  fill_send = function(asset) {
    var element = '.assets-main > .data .balance-'+asset.replace(/\./g,'-');
    var balance = $(element).attr('amount');
    if(balance && balance!=='?') {
      if(!isToken(asset)) {
        var spendable = toInt(balance).minus(toInt(assets.fees[asset]));
      } else {
        var spendable = toInt(balance);
      }
      if(spendable<0) { spendable=0; }
      $('#action-send .modal-send-currency').html(asset.toUpperCase());
      $('#action-send .modal-send-currency').attr('asset',asset);
      $('#action-send .modal-send-balance').html(formatFloat(spendable));
      $('#modal-send-target').val('');
      $('#modal-send-amount').val('');
      $('#action-send .modal-send-addressfrom').html(assets.addr[asset]);
      $('#action-send .modal-send-networkfee').html(String(assets.fees[asset]).replace(/0+$/, '')+' '+asset.split('.')[0].toUpperCase());
      check_tx();
    }
  }
  fill_recv = function(asset) {
    $('#action-receive .modal-receive-currency').html(asset.toUpperCase());
    // after getting address from hybridd, set data-clipboard-text to contain it
    $('#action-receive .modal-receive-addressfrom').html(assets.addr[asset]);
    $('#modal-receive-button').attr('data-clipboard-text', $('#action-receive .modal-receive-addressfrom').html() ) // set clipboard content for copy button to address
    clipboardButton('#modal-receive-button', clipb_success, clipb_fail); // set function of the copy button
    $('#action-receive .modal-receive-status').attr('id','receivestatus-'+asset);
    $("#qrcode").html('').append( function() {
      new QRCode(document.getElementById("qrcode"),
          { text:assets.addr[asset],
            width: 160,
            height: 160,
            colorDark : "#000000",
            colorLight : "#ffffff",
            correctLevel : QRCode.CorrectLevel.H
          });
    });
  }
  stop_recv = function() {
    $('#action-receive .modal-receive-status').attr('id','receivestatus'); // reset status ID attribute to avoid needless polling
  }
  check_tx = function() {
      var p = {};
      p.asset = $('#action-send .modal-send-currency').attr('asset');
      p.target_address = String($('#modal-send-target').val());
      p.amount = Number($("#modal-send-amount").val());
      p.available = Number($('#action-send .modal-send-balance').html());
      if(!isNaN(p.amount) && p.amount>0 && p.amount<=p.available && p.target_address) {
        $('#action-send .pure-button-send').removeClass('disabled');
      } else {
        $('#action-send .pure-button-send').addClass('disabled');
      }
  }

  // fill asset elements
  ui_assets = function(properties) {
    var i;
    for (i = 0; i < GL.assetsActive.length; i++) {
      setTimeout(
        function(i) {      
          if(typeof balance.asset[i] !== 'undefined') {
            var element = '.assets-main > .data .balance-'+balance.asset[i].replace(/\./g,'-');
            if((balance.lasttx[i]+120000)<(new Date).getTime()) {
              hybriddcall({r:'a/'+balance.asset[i]+'/balance/'+assets.addr[balance.asset[i]],z:0},element,
                function(object){
                  var assetbuttons = '.assets-main > .data .assetbuttons-'+balance.asset[i].replace(/\./g,'-');
                  if(object.data!==null && !isNaN(object.data)){
                    $(assetbuttons).delay(1000).removeClass('disabled');
                    $(assetbuttons+' a').removeAttr('disabled');
                    $(assetbuttons+' a').attr('data-toggle', 'modal');
                    $(element).attr('amount',object.data);
                  } else {
                    $(assetbuttons).addClass('disabled');
                    $(assetbuttons+' a').removeAttr('data-toggle');
                    $(element).attr('amount','?');
                  }
                  object.data = UItransform.formatFloat(object.data);
                  return object;
                }
              );
            }
          }
        }
      ,i*500,i);
    }
  }
}