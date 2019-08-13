var redis = require('redis')
  , redis_ips_with_profiles = redis.createClient()
  , redis_tree = redis.createClient()
  , redis_tws_for_ip = redis.createClient()
  , redis_ip_info = redis.createClient()
  , redis_get_timeline = redis.createClient()
  , redis_outtuples_timewindow = redis.createClient()
  , redis_detections_timewindow = redis.createClient()
  , redis_timeline_ip = redis.createClient()
  , async = require('async')
  ,	blessed = require('blessed')
  , contrib = require('blessed-contrib')
  , fs = require('fs')
  , screen = blessed.screen()
  , colors = require('colors');

//read countries  location
let country_loc = {};
fs.readFile('country.txt', 'utf8', function(err,data) {
    if(err) throw err;
    
    let splitted = data.toString().split(";");
    for (let i = 0; i<splitted.length; i++) {
        let splitLine = splitted[i].split(":");
        try{
        	country_loc[splitLine[0]] = splitLine[1].split(",");}
        catch(err){
        }
    }
});


// set up elements of the interface.

var grid = new contrib.grid({
  rows: 6,
  cols: 6,
  screen: screen
});

var table_timeline =  grid.set(0, 1, 2.5, 5, contrib.table, 
  {keys: true
  , vi:true
  , scrollbar: true
  , label: "Timeline"
  , columnWidth:[200]})

  ,table_outTuples =  grid.set(2.5,1,1.8,2.5, contrib.table, 
  { keys: true
  , vi:true
  , scrollbar:true
  , label: "OutTuples"
   , columnWidth:[25,30]})

  , tree =  grid.set(0,0,5,1,contrib.tree,
  { vi:true 
  ,	style: {border: {fg:'magenta'}}
  , template: { lines: true }
  , label: 'Ips from slips'})

  , box_ip = grid.set(5, 0, 0.5, 3.5, blessed.box,
      {top: 'center',
      left: 'center',
      width: '50%',
      height: '50%',
      content: "SELECT IP TO SEE IPS INFO!",
      tags: true,
       style:{
       	 focus: {
      border:{ fg:'magenta'}
    }},
      border: {
      type: 'line'
    }})

 , box_detections = grid.set(2.5, 3.5, 0.9, 2.5,blessed.box,{
  		top: 'center',
  		left: 'center',
  		width: '50%',
  		height: '50%',
  		label:'Detections',
  		tags: true,
 		vi:true,
 		style:{
       	 focus: {
      border:{ fg:'magenta'}
    }},
 		border: {
   		type: 'line'
 		}
	})
 , box_evidence = grid.set(3.4, 3.5, 0.9, 2.5,blessed.box,{
  		top: 'center',
  		left: 'center',
  		width: '50%',
  		height: '50%',
  		label:'Evidence',
  		tags: true,
  		keys: true,
  		style:{
       	 focus: {
      border:{ fg:'magenta'}
    }},
  		vi:true,
  		scrollable: true,
  		alwaysScroll: true,
 		scrollbar: {
    		ch: ' ',
    		inverse: true
  		},
 		border: {
   		type: 'line'
 		},
	})
, box_hotkeys = grid.set(4.3, 1, 0.8, 1, blessed.box,
      {top: 'center',
      left: 'center',
      width: '50%',
      height: '50%',
      style:{
       	 focus: {
      border:{ fg:'magenta'}
    }},
      content: "{bold}-e{/bold} -> SrcPortsClient\n{bold}-b{/bold} -> DstPortsServer\n{bold}-c{/bold} -> dstIpsClient\n{bold}-m{/bold} -> map", //{bold}-b{/bold} -> dstPortServer\n{bold}-c{/bold} -> SrcPortsClient\n
      tags: true,
      border: {
      type: 'line'
    },
    })
, box_bar_state = grid.set(0, 0, 0.5, 6, blessed.box,
      {top: 'center',
      left: 'center',
      width: '50%',
      style:{
       	 focus: {
      border:{ fg:'magenta'}
    }},
      height: '50%',
      tags: true,
      border: {
      type: 'line'
    },
    })
, map = grid.set(0, 0, 6, 6,contrib.map,{label: 'World Map'})
, bar_one = grid.set(0.5,0,3,6,contrib.stackedBar,
       	{ 
         barWidth: 6
       , barSpacing: 10
       , xOffset: 2
       , height: "50%"
       , width: "50%"
       , style:{
       	 focus: {
      border:{ fg:'magenta'}
    }}
       , barBgColor: [ 'red', 'blue', 'green' ]})
, bar_two = grid.set(3.5,0,2.7,6,contrib.stackedBar,
       { 
         barWidth: 6
       , barSpacing: 10
       , xOffset: 2
       , height: "100%"
       , style:{
       	 focus: {
      border:{ fg:'magenta'}
    }}
       , width: "100%"
       , barBgColor: [ 'red', 'blue', 'green' ]})
	box_bar_state.hide()
	bar_one.hide()		
	bar_two.hide()
	map.hide()
var number_bars = Math.floor((2*bar_one.width-2*bar_one.options.xOffset)/(bar_one.options.barSpacing+2*bar_one.options.barWidth));
function round(value, decimals) {
 	return Number(Math.round(value+'e'+decimals)+'e-'+decimals);
};
 
//function to fill in data for a stacked bars
function bar_setdata(bar, counter, data, number){
	bar.clear()
	bar.setData(
    	{ barCategory: data[1].slice(counter,counter+number)
    	, stackedCategory: ['totalflows', 'totalpkt','totalbytes']
    	, data: data[0].slice(counter,counter+number)})
};

//function to fill in data for a box (box displays the state of the bar)
function set_box_bar_state(bar_data, bar_data_two){
	if(bar_data[0].length > number_bars && bar_data_two[0].length > number_bars){
		box_bar_state.setContent('Bars are scrollable. -Tab to change bars. -Left and -Right to  scroll. {bold}Logarithmic scale.{/bold}');
		// bar_one.options.style.border.
		bar_one.focus();}
	else if(bar_data[0].length > number_bars){
		box_bar_state.setContent('Upper bar is scrollable. -Left and -Right to  scroll. {bold}Logarithmic scale.{/bold}');
		bar_one.focus();}
	else if(bar_data_two[0].length > number_bars){
		box_bar_state.setContent('Lower bar is scrollable. -Left and -Right to  scroll. {bold}Logarithmic scale.{/bold}');
		bar_two.focus();}
	else{box_bar_state.setContent('Bars are not scrollable. {bold}Logarithmic scale.{/bold}')};
	bar_one.show();
	bar_two.show();
	box_bar_state.show()
}

//function to fill data about destIpsCLient
function ip_tcp_bars(key, key2,reply){
 	var bar_category_ips = [];
 	var data_stacked_bar = [];
 	try{
	    	var obj_ip = JSON.parse(reply[key]);
			var keys_ip = Object.keys(obj_ip);
		}
	catch(err){
	    	var obj_ip = [];
	    	var keys_ip = [];
	    }
	async.each(keys_ip, function(ip, callback) {
		bar_category_ips.push('TCP/'+ip);
		var ip_info = obj_ip[ip];
		var row = [];
		row.push(ip_info['totalflows'],ip_info['totalpkt']);
		data_stacked_bar.push(row);
		callback();
	}, function(err){
		if(err){
			console.log('sasdfsaa')
		}
		else{
		 	try{
			    	var obj_ip = JSON.parse(reply[key]);
					var keys_ip = Object.keys(obj_ip);
				}
			catch(err){
			    	var obj_ip = [];	
			    	var keys_ip = [];
			    }
			async.each(keys_ip, function(ip, callback) {
				bar_category_ips.push('TCP/'+ip);
				var ip_info = obj_ip[ip];
				var row = [];
				row.push(ip_info['totalflows'],ip_info['totalpkt']);
				data_stacked_bar.push(row);
				callback();
			}, function(err){
				if(err){
					console.log('sasdfsaa')
				}
			});

		}
	});
return [data_stacked_bar, bar_category_ips]
};

//function to fill in the information about the map(loc and lot of a countries)
function setMap(ips){
	
	redis_ip_info.hgetall('IPsInfo', (err,reply)=>{
		async.each(ips, function(ip,callback){
			try{
			var inf = JSON.parse(reply[ip])
			}
			catch(err){
				return;
			}
			var country = inf["geocountry"]
			
			geoloc = country_loc[" "+country]
			
			if(geoloc!=undefined && geoloc !='Private'){
			
			var loc =country_loc[" "+country]
		 	map.addMarker({"lon" : loc[1], "lat" : loc[0], color: "red", char: "X" })}			
			callback();


	}, function(err){
		if(err){
			console.log(err)
		};	
	})

	})
	
};


//function to fill the info about bars (srcPortsServer, dstPortsClient)
function tcp_udp_connections(key, key2,reply){
  		
  		var bar_categories_protocol_port  = []
  		var data_stacked_bar = []
	try{
    	var obj_tcp = JSON.parse(reply[key]);
		var keys_tcp = Object.keys(obj_tcp);
	}
    catch(err){
   
    	var obj_tcp =[]
    	var keys_tcp = []

    }

	async.each(keys_tcp, function(key_TCP_est, callback) {
		bar_categories_protocol_port.push('TCP/'+key_TCP_est);
		var service_info = obj_tcp[key_TCP_est];
		var row = [];
		row.push(round(Math.log(service_info['totalflows']),0), round(Math.log(service_info['totalpkt']),0), round(Math.log(service_info['totalbytes']),0));
		data_stacked_bar.push(row);
		callback();
	}, function(err) {

	if( err ) {
		console.log('unable to create user');
	} else {

	try{
		var obj_udp = JSON.parse(reply[key2]);
		var keys_udp = Object.keys(obj_udp);
	}
	catch(err){
		var obj_udp = []
		var keys_udp = []
	}

	async.each(keys_udp, function(key_UDP_est, callback) {
		bar_categories_protocol_port.push('UDP/'+key_UDP_est);
		var service_info = obj_udp[key_UDP_est];
		var row = [];
		row.push(round(Math.log(service_info['totalflows']),0), round(Math.log(service_info['totalpkt']),0), round(Math.log(service_info['totalbytes']),0));
		data_stacked_bar.push(row);
		callback()
		}, function(err) {
			if( err ) {
				console.log('unable to create user');
			}
		});
	}

});
return [data_stacked_bar,bar_categories_protocol_port]}

function timewindows_list_per_ip(tw){

 	/*
 	create a list of dictionaries with tws(to set the tree). [{'tw1':{},'tw2':{}"}]
 	*/
	var temp_list = []
	var dict = {};
	for(i=0; i<tw.length; i++){
		dict[tw[i]] = {}};
		temp_list.push(dict);
	return temp_list;
 };



function getIpInfo_box_ip(ip){
	/*
	retrieves IPsInfo from redis.
	*/
	
	redis_timeline_ip.hgetall("IPsInfo",(err,reply)=>{
		try{
		var obj = JSON.parse(reply[ip]);
  		var l =  Object.values(obj)
  		box_ip.setContent(l.join(', '));
      	screen.render();}
      	catch (err){
      		box_ip.setContent(reply[ip]);
      	    screen.render();
      	}
    });
};

function getEvidence(reply){
	/*
	retrieves IPsInfo from redis.
	*/
	var ev = ''
	try{
		var obj = JSON.parse(reply);
		var keys = Object.keys(obj);
  		async.each(keys, (key,callback)=>{
  			ev = ev+'{bold}'+key.green+'{/bold}'+" "+obj[key]+'\n'
  			callback();
  		}, function(err){
  			if(err);
  			box_evidence.setContent(ev);
  		})
      	screen.render();}
  	catch (err){
  		return;
  	}
};


function set_tree_data(timewindows_list){
	/*
	sets ips and their tws for the tree.
	*/
  var ips_with_profiles = Object.keys(timewindows_list);
  var explorer = { extended: true
  , children: function(self){
      var result = {};
      try {
        if (!self.childrenContent) {
          for(i=0;i<ips_with_profiles.length;i++){
          	var tw = timewindows_list[ips_with_profiles[i]]
            child = ips_with_profiles[i];
            result[child] = { name: child, extended:false, children: tw[0]};
            }
        }else
        result = self.childrenContent;
      } catch (e){}
      return result;
    }
}
return explorer;};


async.waterfall([
	/*async_waterfall to fill the data for the tree*/
	function get_IPs_with_profiles(callback){
		/*
		retrieve ips with profile from redis key 'Profiles'
		*/
		var ips_with_profiles = [];
		redis_tree.keys('*', (err,reply)=>{
			if(err){callback(err)}
			async.each(reply, function(key,callback){
				if(key.includes('timewindow')){
					ips_with_profiles.push(key.split('_')[1]);
				}
				callback(null)
			},function(err) {

		 if( err ) {
		 	console.log('unable to create user');
		 }else {
		 	callback(null, ips_with_profiles);
		 };
		})


})},

	function get_tws_for_ips(ips_with_profiles, callback){
		var tree_dict = {};
		function createUser(ip_profile, reply, callback)
		{
			tree_dict[ip_profile]=timewindows_list_per_ip(reply);	
		 	callback(null);
		}
		async.each(ips_with_profiles, function(ip_profile, callback) {
		redis_tws_for_ip.zrangebyscore("twsprofile_"+ip_profile,
		   			Number.NEGATIVE_INFINITY,Number.POSITIVE_INFINITY, (err,reply)=>{
		    			if(err){
		      				callback(err);
		   				}else{
		   					createUser(ip_profile,reply, callback);
		        	}})
		}, function(err,res) {
		 if( err ) {
		 console.log('unable to create user');
		 } else {		 
		 callback(null,  tree_dict);

		 }
		})}, 

  	function setTree(timewindows_list,callback){
  		tree.setData(set_tree_data(timewindows_list));
  		screen.render();
  		callback(null)
  	}
], function(err){if(err){console.log(err)}});

tree.on('select',function(node){

    if(!node.name.includes('timewindow')){
    	getIpInfo_box_ip(node.name)}
  		
    else{
    
    //get infor about outtuples of a selected timeline
    redis_outtuples_timewindow.hgetall("profile_"+node.parent.name+"_"+node.name, (err,reply)=>{
    	var ips = []	
    	map.innerMap.draw(null)
        if(reply == null){
        	table_outTuples.setData({headers: [''], data: []})
        	box_detections.setContent('');
        	return;}
	    box_detections.setContent(reply['Detections']);
	    getEvidence(reply['Evidence'])
	    

	    var obj_outTuples = JSON.parse(reply["OutTuples"])
	    var keys = Object.keys(obj_outTuples);
	    var data = [];

	    async.each(keys, function(key,callback){
	      var row = [];
	      var tuple_info = obj_outTuples[key]
	      ips.push(key.split(':')[0])


	      row.push(key,tuple_info[0].trim());
	      data.push(row);
	      callback(null);

  		},function(err) {
 		if( err ) {
			console.log('unable to create user');
 		} else {
 			table_outTuples.setData({headers: [''], data: data});
 			setMap(ips)
		screen.render();	
 		}
		});

//display two bars of srcPortsClient established and non established connections
	var bar_state_one = true;	
	screen.key('e', function(ch, key) {
		var first_bar_counter = 0;
		var second_bar_counter = 0;
		bar_one.options.barSpacing = 10;
		bar_two.options.barSpacing = 10;
		if(bar_state_one){
			var est_connections_srcPortsClient = tcp_udp_connections("SrcPortsClientTCPEstablished","SrcPortsClientUDPEstablished",reply);
			var notEst_connections_srcPortsClient = tcp_udp_connections("SrcPortsClientTCPNotEstablished","SrcPortsClientUDPNotEstablished",reply);
			var est_bar_number_srcPortsClient = Math.ceil(est_connections_srcPortsClient[0].length / number_bars);
			var notEst_bar_number_srcPortsClient = Math.ceil(notEst_connections_srcPortsClient[0].length /number_bars);
			set_box_bar_state(est_connections_srcPortsClient,notEst_connections_srcPortsClient)
			bar_setdata(bar_one, first_bar_counter,est_connections_srcPortsClient, number_bars);
			bar_setdata(bar_two, second_bar_counter, notEst_connections_srcPortsClient, number_bars);

			bar_one.setLabel({text:'SrcPortsClientEstablished'.green,side:'left'});
			bar_two.setLabel({text:'SrcPortsClientNotEstablished'.green,side:'left'});
			screen.render();


			screen.key('right', function(ch, key) {
				if(bar_one.focused == true){

				  	if(first_bar_counter >= (est_bar_number_srcPortsClient-1)*number_bars);
				  	else{
						first_bar_counter += number_bars;				  		
				  		bar_setdata(bar_one, first_bar_counter, est_connections_srcPortsClient, number_bars);}}
			  	else{
			  		if(second_bar_counter >= (notEst_bar_number_srcPortsClient-1)*number_bars); 
				  	else {
				  		second_bar_counter += number_bars;
				  		bar_setdata(bar_two, second_bar_counter, notEst_connections_srcPortsClient, number_bars);}
			  	}
				screen.render()
		});
			screen.key('left', function(ch, key) {
				if(bar_one.focused == true){
				  	first_bar_counter -=number_bars;
				  	if(first_bar_counter<0)first_bar_counter=0;
				  	bar_setdata(bar_one, first_bar_counter, est_connections_srcPortsClient, number_bars);}
			  	else{
			  		second_bar_counter -= number_bars;
			  		if(second_bar_counter<0)second_bar_counter=0;
				  	bar_setdata(bar_two, second_bar_counter, notEst_connections_srcPortsClient, number_bars);
			  	}
				screen.render()
			});

		}
		else{
  			bar_one.hide();
  			bar_two.hide();
  			box_bar_state.hide();
  		}
  		bar_state_one = !bar_state_one;
  		screen.render()
	
});


//display two bars of dstPortsServer established and non established connections
var bar_state_two = true;
	screen.key('b', function(ch, key) {
		var first_bar_counter = 0;
		var second_bar_counter = 0;
		bar_one.options.barSpacing = 10;
		bar_two.options.barSpacing = 10;
		if(bar_state_two){
			var est_connections_dstPortsServer = tcp_udp_connections("DstPortsServerTCPEstablished","DstPortsServerUDPEstablished",reply);
			var notEst_connections_dstPortsServer = tcp_udp_connections("DstPortsServerTCPNotEstablished","DstPortsServerUDPNotEstablished",reply);
			var est_bar_number_dstPortsServer = Math.ceil(est_connections_dstPortsServer[0].length / number_bars);
			var notEst_bar_number_dstPortsServer = Math.ceil(notEst_connections_dstPortsServer[0].length /number_bars);
			set_box_bar_state(est_connections_dstPortsServer,notEst_connections_dstPortsServer)
			bar_setdata(bar_one, first_bar_counter,est_connections_dstPortsServer, number_bars);
			bar_setdata(bar_two, second_bar_counter, notEst_connections_dstPortsServer, number_bars);
			bar_one.setLabel({text:'DstPortsServerEstablished'.green,side:'left'});
			bar_two.setLabel({text:'DstPortsServerNotEstablished'.green,side:'left'});
			screen.render();
			screen.key('Tab', function(ch, key) {
				if(bar_one.focused == true)bar_two.focus();
				else if(bar_two.focused == true)bar_one.focus();
			   	screen.render()
   			});
   			
			screen.key('right', function(ch, key) {
				if(bar_one.focused == true){

				  	if(first_bar_counter >= (est_bar_number_dstPortsServer-1)*number_bars);
				  	else{
						first_bar_counter += number_bars;				  		
				  		bar_setdata(bar_one, first_bar_counter, est_connections_dstPortsServer,number_bars);}}
			  	else{
			  		if(second_bar_counter >= (notEst_bar_number_dstPortsServer-1)*number_bars); 
				  	else {
				  		second_bar_counter += number_bars;
				  		bar_setdata(bar_two, second_bar_counter, notEst_connections_dstPortsServer, number_bars);}
			  	}
				screen.render()
		});
			screen.key('left', function(ch, key) {
				if(bar_one.focused == true){
				  	first_bar_counter -=number_bars;
				  	if(first_bar_counter<0)first_bar_counter=0;
				  	bar_setdata(bar_one, first_bar_counter, est_connections_dstPortsServer,number_bars);}
			  	else{
			  		second_bar_counter -= number_bars;
			  		if(second_bar_counter<0)second_bar_counter=0;
				  	bar_setdata(bar_two, second_bar_counter, notEst_connections_dstPortsServer,number_bars);
			  	}
				screen.render()
			});

		}
		else{
  			bar_one.hide();
  			bar_two.hide();
  			box_bar_state.hide();
  		}
  		bar_state_two= !bar_state_two;
  		screen.render()
	
});

//display two bars of dstIPsClient established and non established connections
var bar_state_three = true;
	screen.key('c', function(ch, key) {
		var first_bar_counter = 0;
		var second_bar_counter = 0;
		bar_one.options.barSpacing = 25;
		bar_two.options.barSpacing = 25;
		if(bar_state_three){
			var number_bars_ips = 5
			var est_connections_ips = tcp_udp_connections("DstIPsClientTCPEstablished","DstIPsClientUDPEstablished",reply);
			var notEst_connections_ips= tcp_udp_connections("DstIPsClientTCPNotEstablished","DstIPsClientUDPNotEstablished",reply);
			var est_ips_bar_number = Math.ceil(est_connections_ips[0].length / number_bars_ips);
			var notEst_ips_bar_number = Math.ceil(notEst_connections_ips[0].length /number_bars_ips);
			set_box_bar_state(est_connections_ips,notEst_connections_ips)

			bar_setdata(bar_one, first_bar_counter,est_connections_ips,number_bars_ips);
			bar_setdata(bar_two, second_bar_counter, notEst_connections_ips,number_bars_ips);
			bar_one.setLabel({text:'DstIPsClientEstablished'.green,side:'left'});
			bar_two.setLabel({text:'DstIPsClientNotEstablished'.green,side:'left'});
			screen.render();
			screen.key('Tab', function(ch, key) {
				if(bar_one.focused == true)bar_two.focus();
				else if(bar_two.focused == true)bar_one.focus();
			   	screen.render()
   			});
   			
			screen.key('right', function(ch, key) {
				if(bar_one.focused == true){

				  	if(first_bar_counter >= (est_ips_bar_number-1)*number_bars_ips);
				  	else{
						first_bar_counter += number_bars_ips;				  		
				  		bar_setdata(bar_one, first_bar_counter, est_connections_ips,number_bars_ips);}}
			  	else{
			  		if(second_bar_counter >= (notEst_ips_bar_number-1)*number_bars_ips); 
				  	else {
				  		second_bar_counter += number_bars_ips;
				  		bar_setdata(bar_two, second_bar_counter, notEst_connections_ips,number_bars_ips);}
			  	}
				screen.render()
		});
			screen.key('left', function(ch, key) {
				if(bar_one.focused == true){
				  	first_bar_counter -= number_bars_ips;
				  	if(first_bar_counter<0)first_bar_counter=0;
				  	bar_setdata(bar_one, first_bar_counter, est_connections_ips,number_bars_ips);}
			  	else{
			  		second_bar_counter -= number_bars_ips;
			  		if(second_bar_counter<0)second_bar_counter=0;
				  	bar_setdata(bar_two, second_bar_counter, notEst_connections_ips,number_bars_ips);
			  	}
				screen.render()
			});

		}
		else{
  			bar_one.hide();
  			bar_two.hide();
  			box_bar_state.hide();
  		}
  		bar_state_three = !bar_state_three;
  		screen.render()
	
});

}) 

    //get the timeline of a selected ip
    redis_get_timeline.lrange("profile_"+node.parent.name+"_"+node.name+'_timeline',0,-1, (err,reply)=>{
    	var data = [];
    	async.each(reply, function(line, callback){
    		var row = [];
    		var line_arr = line.split(" ")
	      	var index_to = line_arr.indexOf('to')
	      	var index_ip = index_to +1
	      	if(index_to>=0)line_arr[index_ip]= "{bold}"+line_arr[index_ip]+"{/bold}"
	      	line_arr[1]= line_arr[1].substring(0, line_arr[1].lastIndexOf('.'));
			row.push(line_arr.join(" "));
			data.push(row);
			callback();
    	},function(err) {

 		if( err ) {
 			console.log('unable to create user');
 		} else {
 			table_timeline.setData({headers:[node.parent.name+" "+node.name], data: data});

			screen.render();}
		});
    	})

    var map_state = true
	screen.key('m', function(ch, key) {
		if(map_state){
			map.show()
		}
		else{
  			map.hide()	
  		}
  		map_state = !map_state;
  		screen.render()
	
});
   
    }
});

table_timeline.rows.on('select', (item, index) => {
	var timeline_line = item.content.split(" ");
	var timeline_ip = timeline_line[6].slice(6,-7)
	getIpInfo_box_ip(timeline_ip)
});

table_outTuples.rows.on('select', (item, index) => {
	var outTuple_ip = item.content.trim().split(":")[0]
	getIpInfo_box_ip(outTuple_ip)

});
screen.key(['escape', 'q', 'C-c'], function(ch, key) {
  return process.exit(0);
});



screen.key(['tab'], function(ch, key) {
	if(bar_one.focused == true){
		bar_two.focus();}
			else if(bar_two.focused == true)
		{bar_one.focus();}

  else if(screen.focused == tree.rows){
	tree.style.border.fg = 'blue'
  	table_timeline.style.border.fg='magenta'
    table_timeline.focus();}
  else if(screen.focused == table_timeline.rows){
  	table_timeline.style.border.fg='blue'
  	table_outTuples.style.border.fg='magenta'
  	table_outTuples.focus();}
  else if(screen.focused == table_outTuples.rows){
  	table_outTuples.style.border.fg='blue'
  	box_detections.focus()}
  else if(screen.focused == box_detections){
  	box_evidence.focus()}
  else{
  	tree.style.border.fg = 'magenta'
    tree.focus();}
   
screen.render();
});
tree.focus();
screen.on('resize', function() {
  tree.emit('attach');
  table_timeline.emit('attach');
  table_outTuples.emit('attach');
  box_detections.emit('attach');
  box_evidence.emit('attach');
  box_ip.emit('attach');
  box_hotkeys.emit('attach');
  map.emit('attach');
  bar_two.emit('attach');
  bar_one.emit('attach');
});

screen.render();
