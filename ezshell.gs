// load metaxploit
root=get_shell.host_computer.File("/")
pmx = null
mx = null
newFiles=[]
newFiles=newFiles+root.get_folders+root.get_files
while newFiles.len
    currFile=newFiles.pull
    if currFile.is_folder then newFiles=currFile.get_folders+currFile.get_files+newFiles
    test=include_lib(currFile.path)
    if typeof(test) == "MetaxploitLib" and not pmx then
        pmx=currFile.path
    end if
end while
if not pmx then
    exit("Error: missing lib metaxploit.so")
else
    mx = include_lib(pmx)
end if


// load crypto
root=get_shell.host_computer.File("/")
pcr = null
cr = null
newFiles=[]
newFiles=newFiles+root.get_folders+root.get_files
while newFiles.len
    currFile=newFiles.pull
    if currFile.is_folder then newFiles=currFile.get_folders+currFile.get_files+newFiles
    test=include_lib(currFile.path)
    if typeof(test) == "cryptoLib" and not pcr then
        pcr=currFile.path
    end if
end while
if not pcr then
    if not cr then user_input("Warning: missing lib crypto.so. Hash reverse command is disabled.\nPress any key to continue...", false, true)
else
    cr = include_lib(pcr)
end if



// init local vars
local = {}
local.shell = get_shell
local.comp = get_shell.host_computer
local.router = get_router
local.folder = local.comp.File(current_path)
local.user = active_user
local.lan = get_shell.host_computer.local_ip
local.ip = get_router.public_ip


// init current vars
current = {}
current.obj = local.shell
current.router = local.router
current.folder = local.folder
current.user = local.user
current.lan = local.lan
current.ip = function()
	return current.router.public_ip
end function
current.objType = function()
	return typeof(current.obj)
end function


// init global vars
vars = {}
vars.show_ip = false
vars.show_lan = true


// init memory list
memory = {}
memory.cmd_history = []

// results for hacking
results = {}
results.shell = []
results.computer = []
results.file = []
results.number = []


// init commands
g_cmds = {} // commands always available
sys_cmds = {} // script system commands
cmds = {} // commands for different objects
cmds.shell = {}
cmds.computer = {}
cmds.file = {}

sys_cmds.reform_size = function(bytes)
    bytes = bytes.to_int
	i=0
	units = ["b","kb","mb","gb","tb","pb"]
	while bytes > 1024
		bytes=bytes/1024
		i=i+1
	end while
	return round(bytes,2) + units[i]
end function

sys_cmds.checkUser = function(result)
    user = ""
    rfile = null
    if typeof(result) == "computer" then
        file = result.File("/home")
        rfile = result.File("/root")
    else if typeof(result) == "shell" then
        file = result.host_computer.File("/home")
        rfile = result.host_computer.File("/root")
    end if
    if rfile and rfile.has_permission("r") then
        user = "root"
    else if rfile and file then
        for folder in file.get_folders
            if folder.has_permission("r") and folder.name != "guest" and folder.is_folder then user = folder.name
        end for
    end if
    if typeof(result) == "file" then
        file = result
        if file.name != "/" then
            file = file.parent
            while file.name != "/"
                file = file.parent
            end while
        end if
        for folder in file.get_folders
            if folder.name == "root" then
                if folder.has_permission("r") then user = "root"
            end if
            if folder.name == "home" and user != "root" then
                for sub in folder.get_folders
                    if sub.has_permission("r") and sub.name != "guest" then user = sub.name
                end for
            end if
        end for
    end if
    if user == "" then user = "guest"
    return user
end function



g_cmds.hash = function(args)
    if not cr then
        print("missing crypto.so")
        return 
    end if
	show = false
	if args.len >= 2 then
		for arg in args
			if arg == "-s" then
				show = true
				print("<size=90%>show mode enabled\n")
				break
			end if
		end for
	end if
	
    output = []
    for arg in args
		for cipher in arg.split(char(10))
			if cipher == "-s" then continue
		
       		if cipher.indexOf(":") then
            	user = cipher.split(":")[0]
            	hash = cipher.split(":")[1]
        	else
            	user = null
            	hash = cipher
        	end if
        
        	pass = cr.decipher(hash)
        	if not pass then print("wrong syntax: " + hash + "\n")
		
			if show then
				if user then print(user + ":" + pass + "\n")
				if not user then print(pass + "\n")
			end if
		
        	if user then output.push(user + ":" + pass)
        	if not user then output.push(pass)
    	end for
    end for
    return output.join("\n")
end function

cmds["shell"]["hash"] = {"name": "hash", "description": "deciphering user:hash and hash strings (split them with spaces)", "args": "[*user:hash/hash] [opt: -s]"}
cmds["shell"]["hash"]["run"] = function(args)
    return g_cmds.hash(args)
end function

cmds["computer"]["hash"] = {"name": "hash", "description": "deciphering user:hash and hash strings (split them with spaces)", "args": "[*user:hash/hash] [opt: -s]"}
cmds["computer"]["hash"]["run"] = function(args)
    return g_cmds.hash(args)
end function

cmds["file"]["hash"] = {"name": "hash", "description": "deciphering user:hash and hash strings (split them with spaces)", "args": "[*user:hash/hash] [opt: -s]"}
cmds["file"]["hash"]["run"] = function(args)
    return g_cmds.hash(args)
end function


g_cmds.nmap = function(args)
    if args.len < 1 then return "wrong params!"

    ip = args[0]
    if not is_valid_ip(ip) then ip = nslookup(ip)
    if not is_valid_ip(ip) then return "ip not found!"
	print("scanning " + ip + "...\n")

    islan = is_lan_ip(ip)

    if islan then
        router = get_router
    else
        router = get_router(ip)
    end if

    if not router then return "ip not found!"

    // colors
    op = "<color=#88DA7A>"
    un = "<color=#D0DA7A>"
    cl = "<color=#DC6F6F>"
    res = "</color>"

    // getting a list of devices
    key_in_dict = function(dict, key)
    	for i in dict
    		if key == i.key then return true
    	end for
    	return false
    end function

    lans = router.devices_lan_ip
    devices = {}

    for lan in lans
    	ports = router.device_ports(lan)
    	for port in ports
    		lan = port.get_lan_ip
    		if key_in_dict(devices, lan) then
    			devices[lan].push(port)
    		else
    			devices = devices + {lan: [port]}
    		end if
    	end for
        if not ports then devices = devices + {lan: []}
    end for

    // scanning available devices
    scanned = []

    uports = router.used_ports
    ulans = []
    for port in uports
    	if typeof(ulans.indexOf(port.get_lan_ip)) != "number" then ulans.push(port.get_lan_ip)
    end for
	
    whois_info = whois(ip)
    for wh in whois_info.split("\n")
    	str = wh.split(":")[0]
    	info = wh.split(":")[1]
    	if str == "Domain name" then
    		print("| Company name:  "+op + info.replace(" ", "").split(".")[0])
    		print("| Website:  "+op+"www." + info.replace(" ", ""))
    	else if str == "Administrative contact" then
    		print("| Admin fullname: "+op + info)
    	else if str == "Error" then
    		print("| <b><color=red>" + info)
    	else
    		print("| " + str + ": "+op + info)
    	end if
    end for
    for port in uports
        if port.is_closed then print("| |"+cl+"-x-"+res+"> " + port.port_number + " " + router.port_info(port) + " -> " + port.get_lan_ip)
        if not port.is_closed then print("| |"+op+"---"+res+"> " + port.port_number + " " + router.port_info(port) + " -> " + port.get_lan_ip)
    end for

    p = router.ping_port(8080)
    s = cl+"closed"+res
    if islan then s = op+"open"+res
    info = ["TYPE LAN PORT "+op+res+"STATUS SERVICE VERSION", "router "+router.local_ip+" /", "  |0 "+op+"open"+res+" router "+router.kernel_version, "  |"+p.port_number+" "+s+" "+router.port_info(p)]

    for device in devices
    	lan = device.key
    	ports = device.value
    	scanned_ports = []
    
    	if lan == router.local_ip or typeof(scanned.indexOf(lan)) == "number" then continue
    
    	if ports then
    		type = "server"
    		for p in ports
    			if p.port_number == 8080 then type = "subnet"
    			if p.port_number == 37777 then type = "cctv"
    		end for
    	else
    		type = "computer"
    	end if
    
    	info.push(type+" "+lan+" /")
    
    	for port in ports
    		if typeof(scanned_ports.indexOf(port.port_number)) == "number" then continue
        
    		connect = false
    		for l in ulans
    			if l == lan then
    				connect = true
    				break
    			end if
    		end for
        
    		status = op+"open"+res 
    		if not connect then status = un+"unreach"+res 
    		if port.is_closed and not islan then status = cl+"closed"+res
        
    		info.push("  |"+port.port_number+" "+status+" "+router.port_info(port))
    		scanned_ports.push(port.port_number)
    	end for
    	scanned.push(lan)
    end for

    print("\n" + format_columns(info.join("\n")))

    print("furewall:")
    info = "<color=#EBB26E>ACTION PORT SOURCE DESTINATION"
    firewalls = router.firewall_rules
    if firewalls.len < 1 then
    	print(op+"No firewall rules\n")
    else
    	for fw in firewalls
    		action = fw.split(" ")[0]
    		if action == "ALLOW" then info = info + "\n"+op + fw
    		if action == "DENY" then info = info + "\n"+cl + fw
    	end for
    	print(format_columns(info)+"\n")
    end if
end function

cmds["shell"]["nmap"] = {"name": "nmap", "description": "show full network information", "args": "[ip]"}
cmds["shell"]["nmap"]["run"] = function(args)
    return g_cmds.nmap(args)
end function

cmds["computer"]["nmap"] = {"name": "nmap", "description": "show full network information", "args": "[ip]"}
cmds["computer"]["nmap"]["run"] = function(args)
    return g_cmds.nmap(args)
end function

cmds["file"]["nmap"] = {"name": "nmap", "description": "show full network information", "args": "[ip]"}
cmds["file"]["nmap"]["run"] = function(args)
    return g_cmds.nmap(args)
end function


g_cmds.show = function(args)
    for arg in args
        if arg == "ip" then vars.show_ip = not vars.show_ip
        if arg == "lan" then vars.show_lan = not vars.show_lan
    end for
    return true
end function

cmds["shell"]["show"] = {"name": "show", "description": "show/hide lan and public ip", "args": "[*""ip""/""lan""]"}
cmds["shell"]["show"]["run"] = function(args)
    return g_cmds.show(args)
end function

cmds["computer"]["show"] = {"name": "show", "description": "show/hide lan and public ip", "args": "[*""ip""/""lan""]"}
cmds["computer"]["show"]["run"] = function(args)
    return g_cmds.show(args)
end function

cmds["file"]["show"] = {"name": "show", "description": "show/hide lan and public ip", "args": "[*""ip""/""lan""]"}
cmds["file"]["show"]["run"] = function(args)
    return g_cmds.show(args)
end function


g_cmds.last = function(cmd)
    execute(cmd)
end function

cmds["shell"]["<"] = {"name": "<", "description": "launch the last command", "args": "[opt: -p]"}
cmds["shell"]["<"]["run"] = function(args)
    if memory.cmd_history then
		if args.len == 1 and args[0] == "-p" then
			print(memory.cmd_history[-1])
		else
			g_cmds.last(memory.cmd_history[-1])
		end if
	end if
end function

cmds["computer"]["<"] = {"name": "<", "description": "launch the last command", "args": "[opt: -p]"}
cmds["computer"]["<"]["run"] = function(args)
    if memory.cmd_history then
		if args.len == 1 and args[0] == "-p" then
			print(memory.cmd_history[-1])
		else
			g_cmds.last(memory.cmd_history[-1])
		end if
	end if
end function

cmds["file"]["<"] = {"name": "<", "description": "launch the last command", "args": "[opt: -p]"}
cmds["file"]["<"]["run"] = function(args)
    if memory.cmd_history then
		if args.len == 1 and args[0] == "-p" then
			print(memory.cmd_history[-1])
		else
			g_cmds.last(memory.cmd_history[-1])
		end if
	end if
end function


g_cmds.all_last = function(args)
	out = "\n"
	i = 0
	for cmd in memory.cmd_history
		out = out + "[" + i + "] " + cmd + "\n"
		i = i + 1
	end for
	out = out + "\n[" + i + "] exit\n"
	
	print(out)
	
	while true
        pick = user_input(">> ").to_int
        if typeof(pick) != "number" then continue
        if pick == i then return
        if memory.cmd_history.hasIndex(pick) then break
    end while

	execute(memory.cmd_history[pick])
end function

cmds["shell"]["<<"] = {"name": "<<", "description": "run command from memory", "args": ""}
cmds["shell"]["<<"]["run"] = function(args)
	g_cmds.all_last(args)
end function

cmds["computer"]["<<"] = {"name": "<<", "description": "run command from memory", "args": ""}
cmds["computer"]["<<"]["run"] = function(args)
	g_cmds.all_last(args)
end function

cmds["file"]["<<"] = {"name": "<<", "description": "run command from memory", "args": ""}
cmds["file"]["<<"]["run"] = function(args)
	g_cmds.all_last(args)
end function


cmds["shell"]["clear"] = {"name": "clear", "description": "clear screen", "args": "[opt: -p]"}
cmds["shell"]["clear"]["run"] = function(args)
    clear_screen
end function

cmds["computer"]["clear"] = {"name": "clear", "description": "clear screen", "args": ""}
cmds["computer"]["clear"]["run"] = function(args)
    clear_screen
end function

cmds["file"]["clear"] = {"name": "clear", "description": "clear screen", "args": ""}
cmds["file"]["clear"]["run"] = function(args)
    clear_screen
end function


cmds["shell"]["ex"] = {"name": "ex", "description": "close the script", "args": ""}
cmds["shell"]["ex"]["run"] = function(args)
    exit
end function

cmds["computer"]["ex"] = {"name": "ex", "description": "close the script", "args": ""}
cmds["computer"]["ex"]["run"] = function(args)
    exit
end function

cmds["file"]["ex"] = {"name": "ex", "description": "close the script", "args": ""}
cmds["file"]["ex"]["run"] = function(args)
    exit
end function


g_cmds.local = function(args)
	globals.current.obj = local.shell
	globals.current.router = local.router
	globals.current.folder = local.folder
	globals.current.user = local.user
	globals.current.lan = local.lan
	return true
end function

cmds["shell"]["local"] = {"name": "local", "description": "go back to local shell", "args": ""}
cmds["shell"]["local"]["run"] = function(args)
    return g_cmds.local(args)
end function

cmds["computer"]["local"] = {"name": "local", "description": "go back to local shell", "args": ""}
cmds["computer"]["local"]["run"] = function(args)
    return g_cmds.local(args)
end function

cmds["file"]["local"] = {"name": "local", "description": "go back to local shell", "args": ""}
cmds["file"]["local"]["run"] = function(args)
    return g_cmds.local(args)
end function


g_cmds.shells = function(args)
	if args and args[0] == "-clear" then
		results.shell = []
		print("cleared")
        return
	end if
	
    output = "\n[#] TYPE USER PUBLIC_IP LAN_IP TARGET VERSION MEMORY VALUE\n"
    i = 0
    for obj in results.shell
        type = typeof(obj.result)
        output = output + "[" + i + "] " + type + " " + obj.user + " " + obj.ip + " " + obj.lan + " " + obj.target + " " + obj.mem + " " + obj.val + "\n"
    	i = i + 1
	end for
    output = output + "[" + i + "] exit\n"

    print(format_columns(output))

    while true
        pick = user_input(">> ").to_int
        if typeof(pick) != "number" then continue
        if pick == i then return
        if results.shell.hasIndex(pick) then break
    end while
    
    obj = results.shell[pick]
	res = obj.result

    globals.current.obj = res
	globals.current.router = get_router(obj.ip)
	globals.current.folder = res.host_computer.File("/")
	globals.current.user = obj.user
	globals.current.lan = obj.lan
end function

cmds["shell"]["shells"] = {"name": "shells", "description": "switching obtanied shells", "args": "[opt: -clear]"}
cmds["shell"]["shells"]["run"] = function(args)
    g_cmds.shells(args)
end function

cmds["computer"]["shells"] = {"name": "shells", "description": "switching obtanied shells", "args": "[opt: -clear]"}
cmds["computer"]["shells"]["run"] = function(args)
    g_cmds.shells(args)
end function

cmds["file"]["shells"] = {"name": "shells", "description": "switching obtanied shells", "args": "[opt: -clear]"}
cmds["file"]["shells"]["run"] = function(args)
    g_cmds.shells(args)
end function


g_cmds.comps = function(args)
	if args and args[0] == "-clear" then
		results.computer = []
        print("cleared")
		return 
	end if
    output = "\n[#] TYPE USER PUBLIC_IP LAN_IP TARGET VERSION MEMORY VALUE\n"
    i = 0
    for obj in results.computer
        type = typeof(obj.result)
        output = output + "[" + i + "] " + type + " " + obj.user + " " + obj.ip + " " + obj.lan + " " + obj.target + " " + obj.mem + " " + obj.val + "\n"
    	i = i + 1
	end for
    output = output + "[" + i + "] exit\n"

    print(format_columns(output))

    while true
        pick = user_input(">> ").to_int
        if typeof(pick) != "number" then continue
        if pick == i then return
        if results.computer.hasIndex(pick) then break
    end while
    
    obj = results.computer[pick]
	res = obj.result

    globals.current.obj = res
	globals.current.router = get_router(obj.ip)
	globals.current.folder = res.File("/")
	globals.current.user = obj.user
	globals.current.lan = obj.lan
end function

cmds["shell"]["comps"] = {"name": "comps", "description": "switching obtanied computers", "args": "[opt: -clear]"}
cmds["shell"]["comps"]["run"] = function(args)
    g_cmds.comps(args)
end function

cmds["computer"]["comps"] = {"name": "comps", "description": "switching obtanied computers", "args": "[opt: -clear]"}
cmds["computer"]["comps"]["run"] = function(args)
    g_cmds.comps(args)
end function

cmds["file"]["comps"] = {"name": "comps", "description": "switching obtanied computers", "args": "[opt: -clear]"}
cmds["file"]["comps"]["run"] = function(args)
    g_cmds.comps(args)
end function


g_cmds.files = function(args)
    if args and args[0] == "-clear" then
		results.file = []
        print("cleared")
		return 
	end if
    output = "\n[#] FILE USER PUBLIC_IP LAN_IP TARGET VERSION MEMORY VALUE\n"
    i = 0
    for obj in results.file
        if vars.show_ip then ip = current.ip
        if vars.show_lan then lan = current.lan
        type = obj.result.path
        output = output + "[" + i + "] " + type + " " + obj.user + " " + obj.ip + " " + obj.lan + " " + obj.target + " " + obj.mem + " " + obj.val + "\n"
    	i = i + 1
	end for
    output = output + "[" + i + "] exit\n"

    print(format_columns(output))

    while true
        pick = user_input(">> ").to_int
        if typeof(pick) != "number" then continue
        if pick == i then return
        if results.file.hasIndex(pick) then break
    end while
    
    obj = results.file[pick]
    res = obj.result

    globals.current.obj = res
    globals.current.router = get_router(obj.ip)
    if res.is_folder then globals.current.folder = res else globals.current.folder = res.parent
    globals.current.user = obj.user
    globals.current.lan = obj.lan
end function

cmds["shell"]["files"] = {"name": "files", "description": "switching obtanied files", "args": "[opt: -clear]"}
cmds["shell"]["files"]["run"] = function(args)
    g_cmds.files(args)
end function

cmds["computer"]["files"] = {"name": "files", "description": "switching obtanied files", "args": "[opt: -clear]"}
cmds["computer"]["files"]["run"] = function(args)
    g_cmds.files(args)
end function

cmds["file"]["files"] = {"name": "files", "description": "switching obtanied files", "args": "[opt: -clear]"}
cmds["file"]["files"]["run"] = function(args)
    g_cmds.files(args)
end function


g_cmds.nums = function(args)
	if args and args[0] == "-clear" then
		results.number = []
        print("cleared")
		return 
	end if
    output = "\n[#] TYPE USER PUBLIC_IP LAN_IP TARGET VERSION MEMORY VALUE\n"
    i = 0
    for obj in results.number
        if vars.show_ip then ip = current.ip
        if vars.show_lan then lan = current.lan
        if obj.result == "<bounce>" then type = obj.result else type = typeof(obj.result)
        output = output + "[" + i + "] " + type + " " + obj.user + " " + obj.ip + " " + obj.lan + " " + obj.target + " " + obj.mem + " " + obj.val + "\n"
    	i = i + 1
	end for
    output = output + "[" + i + "] exit\n"

    print(format_columns(output))
	
	picks = []
    while true
        inp = user_input(">> ")
		
		for pick in inp.split(" ")
        	if typeof(pick.to_int) != "number" then continue
        	if pick.to_int == i then return
        	if results.number.hasIndex(pick.to_int) then picks.push(pick.to_int)
		end for
		
		if picks then break	
    end while

    inj = user_input("injection>> ")

	for pick in picks
    	obj = results.number[pick]
		res = obj.result
	
		ip = obj.ip
		port = obj.target.split(" ")[0].split("-")[0].to_int
		net_session = mx.net_use(ip, port)
    	if net_session then print("Connected!")
    	if not net_session then
            print("Error: connection feiled!")
            return 
        end if

		metaLib = net_session.dump_lib
	
		result = metaLib.overflow(obj.mem, obj.val, inj)
	
		if typeof(result) != "null" and typeof(result) != "number" then
			print("result: <b>" + typeof(result))
		
			user = sys_cmds.checkUser(result)
		
			router = get_router(ip)
		
			new_obj = {"result": result, "user": user, "ip": ip, "lan": inj, "target": "bounce-router " + router.kernel_version, "mem": obj.mem, "val": obj.val}
			if not results[typeof(result)].indexOf(new_obj) then results[typeof(result)].push(new_obj)
		
			print("\nObtained:")
			for i in results
				print("<b> " + i.value.len + "</b> " + i.key + " objects")
			end for
			print(" ")
		
		end if
	end for
end function

cmds["shell"]["nums"] = {"name": "nums", "description": "switching obtanied numbers", "args": "[opt: -clear]"}
cmds["shell"]["nums"]["run"] = function(args)
    g_cmds.nums(args)
end function

cmds["computer"]["nums"] = {"name": "nums", "description": "switching obtanied numbers", "args": "[opt: -clear]"}
cmds["computer"]["nums"]["run"] = function(args)
    g_cmds.nums(args)
end function

cmds["file"]["nums"] = {"name": "nums", "description": "switching obtanied numbers", "args": "[opt: -clear]"}
cmds["file"]["nums"]["run"] = function(args)
    g_cmds.nums(args)
end function


g_cmds.results = function(args)
	if args and args[0] == "-clear" then
		results.shell = []
		results.computer = []
		results.file = []
		results.number = []
        print("cleared")
		return 
	end if
	print("\nObtained:")
	for i in results
		print("<b> " + i.value.len + "</b> " + i.key + " objects")
	end for
	print(" ")
end function

cmds["shell"]["results"] = {"name": "results", "description": "show obtained hacking results", "args": "[opt: -clear]"}
cmds["shell"]["results"]["run"] = function(args)
    g_cmds.results(args)
end function

cmds["computer"]["results"] = {"name": "results", "description": "show obtained hacking resultss", "args": "[opt: -clear]"}
cmds["computer"]["results"]["run"] = function(args)
    g_cmds.results(args)
end function

cmds["file"]["results"] = {"name": "results", "description": "show obtained hacking results", "args": "[opt: -clear]"}
cmds["file"]["results"]["run"] = function(args)
    g_cmds.results(args)
end function


// shell commands
cmds["shell"]["shell"] = {"name":"shell", "description":"Starts a normal shell", "args":""}
cmds["shell"]["shell"]["run"] = function(args)
	return current.obj.start_terminal
end function

cmds["shell"]["help"] = {"name":"help", "description":"List all commands", "args":""}
cmds["shell"]["help"]["run"] = function(args) //func that runs
	output = "\n" + "Shell commands:" + "\n" //first line that needs to be print
	for command in cmds.shell //loop thru each command from Commands
		commandData = command.value //store command info in a var
		output = output + "		" + commandData.name + " " + commandData.args.trim + " -> " + commandData.description+"\n" //store info in output ready to be print
	end for
    print(output) //PRINT IT OUT
	return
end function


cmds["shell"]["rh"] = {"name":"rh", "description":"remote hack", "args":"[ip] [*ports (split: ;)] [opt: injectArg]"}
cmds["shell"]["rh"]["run"] = function(args)
    if not mx then 
        print("missing metaxploit.so")
        return 
    end if
    if args.len < 2 then
        print("invalid args")
        return 
    end if

    ip = args[0] // getting ip
    if not is_valid_ip(ip) then ip = nslookup(ip)
    if not is_valid_ip(ip) then return print("invalid ip: " + ip)

    if is_lan_ip(ip) then router = get_router else router = get_router(ip) // getting router

    str_ports = args[1].split(";") // getting ports
    ports = []
    for port in str_ports
        port = port.to_int
        if typeof(port) != "number" and not router.ping_port(port) then
            print("incorect port: " + port)
            continue
        end if
        ports.push(port)
    end for

    if args.len > 2 then inj = args[2] else inj = "" // getting injection argument

    for port in ports
		if port == 0 then rtr = true else rtr = false
    	if rtr then print("\n<b><size=125%>Trying " + port + " - " + router.kernel_version) else print("\n<b><size=125%>Trying " + port + " - " + router.port_info(router.ping_port(port)))

        net_session = mx.net_use(ip, port)
        if net_session then print("Connected!")
        if not net_session then return print("Error: connection feiled!")

        metaLib = net_session.dump_lib

        memory = mx.scan(metaLib)
        for mem in memory
            address = mx.scan_address(metaLib, mem).split("Unsafe check: ")
            for add in address[1:]
                value = add[add.indexOf("<b>")+3:add.indexOf("</b>")]
		        value = value.replace("\n", "")
				
				lan = null
				bounce = false
                if rtr and inj == "" then
    				result = metaLib.overflow(mem, value, router.devices_lan_ip[0])
					if typeof(result) == "computer" then
						result = 0
						bounce = true
					end if
				else
					result = metaLib.overflow(mem, value, inj)
					if typeof(result) == "computer" then lan = result.local_ip
				end if

    			if typeof(result) == "null" then
					print("vulnerability not found")
					continue
				end if
    	
				if typeof(result) != "number" then user = sys_cmds.checkUser(result) else user = "####"
				if bounce then result = "<bounce>"
				
				if not lan then
					if rtr then lan = router.local_ip else lan = router.ping_port(port).get_lan_ip
				end if
				if rtr then target = port + "-router " + router.kernel_version else target = port + "-" + router.port_info(router.ping_port(port))
	
				new_obj = {"result": result, "user": user, "ip": ip, "lan": lan, "target": target, "mem": mem, "val": value}
				if bounce then result = 0
				if not results[typeof(result)].indexOf(new_obj) then results[typeof(result)].push(new_obj) else print("result already saved")

            end for
        end for
    end for

    print("\nObtained:")
	for i in results
		print("<b> " + i.value.len + "</b> " + i.key + " objects")
	end for
	print(" ")
end function

cmds["shell"]["mrh"] = {"name":"mrh", "description":"local hack without scan", "args":"[ip] [port] [memory] [value] [opt: injectArg]"}
cmds["shell"]["mrh"]["run"] = function(args)
    if not mx then return print("missing metaxploit.so")
    if args.len < 4 then return print("invalid args")

    ip = args[0] // getting ip
    if not is_valid_ip(ip) then ip = nslookup(ip)
    if not is_valid_ip(ip) then return print("invalid ip: " + ip)
    if is_lan_ip(ip) then router = get_router else router = get_router(ip) // getting router

    mem = args[2]
    value = args[3]

    if args.len > 4 then inj = args[4] else inj = "" // getting injection argument

    port = args[1].to_int
    if typeof(port) != "number" then return print("invalid port: " + port)
	if port == 0 then rtr = true else rtr = false
	
    if rtr then print("\n<b><size=125%>Trying " + port + " - " + router.kernel_version) else print("\n<b><size=125%>Trying " + port + " - " + router.port_info(router.ping_port(port)))
	
    net_session = mx.net_use(ip, port)
    if net_session then print("Connected!")
    if not net_session then return print("Error: connection feiled!")

    metaLib = net_session.dump_lib
	
	if rtr and inj == "" then
    	result = metaLib.overflow(mem, value, router.devices_lan_ip[0])
		if typeof(result) == "computer" then result = 0
	else
		result = metaLib.overflow(mem, value, inj)
	end if

    if typeof(result) == "null" then return print("vulnerability not found")
    	
	if typeof(result) != "number" then user = sys_cmds.checkUser(result) else user = "####"
	
	if rtr then lan = router.local_ip else lan = router.ping_port(port).get_lan_ip
	if rtr then target = port + "-router " + router.kernel_version else target = port + "-" + router.port_info(router.ping_port(port))
	
	new_obj = {"result": result, "user": user, "ip": ip, "lan": lan, "target": target, "mem": mem, "val": value}
	if not results[typeof(result)].indexOf(new_obj) then results[typeof(result)].push(new_obj) else print("result already saved")

    print("\nObtained:")
	for i in results
		print("<b> " + i.value.len + "</b> " + i.key + " objects")
	end for
	print()
end function


cmds["shell"]["lh"] = {"name":"lh", "description":"local hack", "args":""}
cmds["shell"]["lh"]["run"] = function(args)
    if not globals.current.ip == globals.local.ip then return print("You must be on the machine executing this program to use this command.")
	if not globals.current.lan == globals.local.lan then return print("You must be on the machine executing this program to use this command.")
    if not mx then return print("missiong metaxploit.so")

    comp = current.obj.host_computer

    out = "\n[#] NAME VERSION\n"
    i = 0
    metalibs = []
    for lib in comp.File("/lib").get_files
        meta = mx.load(lib.path)
        metalibs.push(meta)
        out = out + "[" + i + "] " + meta.lib_name + " " + meta.version + "\n"
        i = i + 1
    end for
    out = out + "[" + i +"] all\n[" + (i+1) + "] exit\n"

    print(format_columns(out))

    while true
		to_hack = []
        pick = user_input(">> ").lower
	
        if pick.to_int == metalibs.len + 1 then return
        if pick.to_int == metalibs.len then
            to_hack = metalibs
        else
			for p in pick.split(" ")
				if typeof(p.to_int) != "number" then continue
				if p.to_int >= metalibs.len + 1 then continue
				
            	if not metalibs.hasIndex(p.to_int) then continue
            	to_hack.push(metalibs[p.to_int])
			end for
        end if
        if to_hack then break
    end while
	
    for meta in to_hack
		print("\n<b><size=125%>Trying " + meta.lib_name + " - " + meta.version)
        memory = mx.scan(meta)
		for mem in memory
			address = mx.scan_address(meta, mem).split("Unsafe check: ")
			for add in address[1:]
				value = add[add.indexOf("<b>")+3:add.indexOf("</b>")]
				value = value.replace("\n", "")
				result = meta.overflow(mem, value)
				
				if typeof(result) == "null" then continue
				
				if typeof(result) != "number" then user = sys_cmds.checkUser(result) else user = "####"
				
				new_obj = {"result": result, "user": user, "ip": local.ip, "lan": local.lan, "target": meta.lib_name + " " + meta.version, "mem": mem, "val": value}
				
				if not results[typeof(result)].indexOf(new_obj) then results[typeof(result)].push(new_obj) else print("result already saved")
			end for
		end for
    end for
	
    //print(results)
	print("\nObtained:")
	for i in results
		print("<b> " + i.value.len + "</b> " + i.key + " objects")
	end for
	print()
end function


cmds["shell"]["mlh"] = {"name":"mlh", "description":"local hack without scan", "args":"[libpath] [memory] [value] [opt: injectArg]"}
cmds["shell"]["mlh"]["run"] = function(args)
    if not globals.current.ip == globals.local.ip then return print("You must be on the machine executing this program to use this command.")
	if not globals.current.lan == globals.local.lan then return print("You must be on the machine executing this program to use this command.")
    if not mx then return print("missiong metaxploit.so")
    if args.len < 3 then return print("invalid args")

    metaLib = mx.load(args[0])
    if not metaLib then return print("metaLib not found")

    if args.len > 3 then inj = args[3] else inj = ""

    result = metaLib.overflow(args[1], args[2], inj)

    if typeof(result) == "null" then return print("vulnerability not found")
    print("result: <b>" + typeof(result))
				
	if typeof(result) != "number" then user = sys_cmds.checkUser(result) else user = "####"
	
	new_obj = {"result": result, "user": user, "ip": local.ip, "lan": local.lan, "target": metaLib.lib_name + " " + metaLib.version, "mem": args[1], "val": args[2]}
	if not results[typeof(result)].indexOf(new_obj) then results[typeof(result)].push(new_obj) else print("result already saved")

    print("\nObtained:")
	for i in results
		print("<b> " + i.value.len + "</b> " + i.key + " objects")
	end for
	print()
end function



cmds["shell"]["cd"] = {"name": "cd", "description": "change current path", "args": "[path]"}
cmds["shell"]["cd"]["run"] = function(args)
    if not args and not args[0] then return

    if current.objType == "shell" then comp = current.obj.host_computer
    if current.objType == "computer" then comp = current.obj

    path = args[0]
    temp = current.folder

    if typeof(path.indexOf("..")) != "number" then
        folder = comp.File(path)
        if not folder then folder = comp.File(current.folder.path + path)
        if not folder then folder = comp.File(current.folder.path + "/" + path)
        if folder then 
            if folder.is_folder then
                current.folder = folder
            else
                current.folder = folder.parent
            end if
        else
            return print("cd: "+path+" not found")
        end if
    else
        for i in path.split("/")
            if i == ".." then
                current.folder = current.folder.parent
            else
                folder = comp.File(current.folder.path + i)
                if not folder then folder = comp.File(current.folder.path + "/" + i)
                if folder then
                    if folder.is_folder then
                        current.folder = folder
                    else
                        corrent.folder = folder.parent
                    end if
                else
                    current.folder = temp
                    return print("cd: "+path+" not found")
                end if
            end if
        end for
    end if

end function


cmds["shell"]["ls"] = {"name": "ls", "description": "show folder content", "args": "[opt: path]"}
cmds["shell"]["ls"]["run"] = function(args)
    
    if current.objType == "shell" then comp = current.obj.host_computer
    if current.objType == "computer" then comp = current.obj

    if args then folder = comp.File(args[0])
    if not args then folder = current.folder

    if not folder then return print("ls: path not found")

    output = ["\n[#] TYPE NAME +RWX SIZE OWNER GROUP PERMISSIONS"]
    folders = folder.get_folders
    files = folder.get_files

    i = 1
    for f in folders + files
        name = f.name
        my_perms = ""
        if f.has_permission("r") then my_perms = my_perms + "R" else my_perms = my_perms + "-"
        if f.has_permission("w") then my_perms = my_perms + "W" else my_perms = my_perms + "-"
        if f.has_permission("x") then my_perms = my_perms + "X" else my_perms = my_perms + "-"
        perms = f.permissions
        size = sys_cmds.reform_size(f.size)
        owner = f.owner
        group = f.group
        perms = f.permissions

        type = "<TXT>"
        if f.is_binary then type = "<BIN>"
        if f.is_folder then type = "<DIR>"

        output.push("["+i+"] "+type+" "+name+" ["+my_perms+"] "+size+" "+owner+" "+group+" "+perms)

        i = i + 1
    end for
    return format_columns(output.join("\n")) + "\n"
end function

cmds["shell"]["cat"] = {"name": "cat", "description": "show file content", "args": "[path]"}
cmds["shell"]["cat"]["run"] = function(args)
    if args.len == 0 then return

    if current.objType == "shell" then comp = current.obj.host_computer
    if current.objType == "computer" then comp = current.obj

    file = comp.File(args[0])
    if not file then file = comp.File(current.folder.path + args[0])
    if not file then file = comp.File(current.folder.path + "/" + args[0])
    if not file then return print("cat: "+args[0]+" not found")

    if not file.is_binary then
        if file.has_permission("r") then
            return file.get_content
        else
            return print("cat: permission diened")
        end if
    else
        return print("cat: "+file.name+" is binary")
    end if

end function

cmds["shell"]["write"] = {"name": "write", "description": "set file content", "args": "[path] [*words]"}
cmds["shell"]["write"]["run"] = function(args)
    if args.len == 0 then return

    if current.objType == "shell" then comp = current.obj.host_computer
    if current.objType == "computer" then comp = current.obj

    file = comp.File(args[0])
    if not file then file = comp.File(current.folder.path + args[0])
    if not file then file = comp.File(current.folder.path + "/" + args[0])
    if not file then return print("write: "+args[0]+" not found")

    content = ""
    if args.len > 1 then content = args[1:].join(" ")

    if not file.is_binary then
        if file.has_permission("w") then
            file.set_content(content.replace("\n", char(10)))
            return print("succesfuly")
        else
            return print("write: permission diened")
        end if
    else
        return print("write: "+file.name+" is binary")
    end if
end function

cmds["shell"]["touch"] = {"name": "touch", "description": "create the empty file", "args": "[path]"}
cmds["shell"]["touch"]["run"] = function(args)
    if args.len == 0 then return

    if current.objType == "shell" then comp = current.obj.host_computer
    if current.objType == "computer" then comp = current.obj

    if args[0].split("/").len > 1 then 
        name = args[0].split("/")[-1]
        path = args[0].replace(name, "")
    else
        name = args[0]
        path = current.folder.path
    end if

    folder = comp.File(path)
    if not folder then folder = comp.File(current.folder.path + path)
    if not folder then folder = comp.File(current.folder.path + "/" + path)
    if not folder then return print("touch: "+args[0]+" not found")

    if folder.has_permission("w") then
        comp.touch(folder.path, name)
        return print("succesfuly")
    else
        return print("touch: permission diened")
    end if
end function

cmds["shell"]["mkdir"] = {"name": "mkdir", "description": "create the empty folder", "args": "[path]"}
cmds["shell"]["mkdir"]["run"] = function(args)
    if args.len == 0 then return

    if current.objType == "shell" then comp = current.obj.host_computer
    if current.objType == "computer" then comp = current.obj

    if args[0].split("/").len > 1 then 
        name = args[0].split("/")[-1]
        path = args[0].replace(name, "")
    else
        name = args[0]
        path = current.folder.path
    end if

    folder = comp.File(path)
    if not folder then folder = comp.File(current.folder.path + path)
    if not folder then folder = comp.File(current.folder.path + "/" + path)
    if not folder then return print("mkdir: "+args[0]+" not found")

    if folder.has_permission("w") then
        comp.create_folder(folder.path, name)
        return print("succesfuly")
    else
        return print("mkdir: permission diened")
    end if
end function

cmds["shell"]["mv"] = {"name": "mv", "description": "move file", "args": "[path] [new path]"}
cmds["shell"]["mv"]["run"] = function(args)
    if args.len <= 1 then return

    if current.objType == "shell" then comp = current.obj.host_computer
    if current.objType == "computer" then comp = current.obj

    path = args[0]

    file = comp.File(path)
    if not file then file = comp.File(current.folder.path + path)
    if not file then file = comp.File(current.folder.path + "/" + path)
    if not file then return print("mv: "+args[0]+" not found")

    if args[1].split("/").len > 1 then 
        name = args[1].split("/")[-1]
        npath = args[1].replace(name, "")
    else
        name = args[1]
        npath = current.folder.path
    end if

    folder = comp.File(npath)
    if not folder then folder = comp.File(current.folder.path + npath)
    if not folder then folder = comp.File(current.folder.path + "/" + npath)
    if not folder then return print("mv: "+args[0]+" not found")
	
	out = file.move(npath, name)
    if typeof(out) == "string" then return out
end function

cmds["shell"]["cp"] = {"name": "cp", "description": "copy file", "args": "[path] [new path]"}
cmds["shell"]["cp"]["run"] = function(args)
    if args.len <= 1 then return

    if current.objType == "shell" then comp = current.obj.host_computer
    if current.objType == "computer" then comp = current.obj

    path = args[0]

    file = comp.File(path)
    if not file then file = comp.File(current.folder.path + path)
    if not file then file = comp.File(current.folder.path + "/" + path)
    if not file then return print("cp: "+args[0]+" not found")

    if args[1].split("/").len > 1 then 
        name = args[1].split("/")[-1]
        npath = args[1].replace(name, "")
    else
        name = args[1]
        npath = current.folder.path
    end if

    folder = comp.File(npath)
    if not folder then folder = comp.File(current.folder.path + npath)
    if not folder then folder = comp.File(current.folder.path + "/" + npath)
    if not folder then return print("cp: "+args[0]+" not found")

    out = file.copy(npath, name)
    if typeof(out) == "string" then return out
end function

cmds["shell"]["rm"] = {"name": "rm", "description": "remove file", "args": "[path]"}
cmds["shell"]["rm"]["run"] = function(args)
    if args.len == 0 then return

    if current.objType == "shell" then comp = current.obj.host_computer
    if current.objType == "computer" then comp = current.obj

    path = args[0]

    file = comp.File(path)
    if not file then file = comp.File(current.folder.path + path)
    if not file then file = comp.File(current.folder.path + "/" + path)
    if not file then return print("rm: "+args[0]+" not found")

    if not file.has_permission("w") then return print("Permission denied.") //check perm
	file.delete //delete file
	return print("File deleted.") //output
end function

cmds["shell"]["ps"] = {"name": "ps", "description": "show all processes in the system", "args": ""}
cmds["shell"]["ps"]["run"] = function(args)

    if current.objType == "shell" then comp = current.obj.host_computer
    if current.objType == "computer" then comp = current.obj

    return format_columns(comp.show_procs)
end function

cmds["shell"]["kill"] = {"name": "kill", "description": "show all processes in the system", "args": "[PID]"}
cmds["shell"]["kill"]["run"] = function(args)
	if args.len == 0 then return
	
	if current.objType == "shell" then comp = current.obj.host_computer
    if current.objType == "computer" then comp = current.obj
	
	out = comp.close_program(args[0].to_int)
	if typeof(out) == "string" then return out
end function

cmds["shell"]["sys"] = {"name": "sys", "description": "shows all system files or searches for them by privileges/names/contents", "args": "[opt: -r -w -x -path:{str} -name:{str} -cont:{str}]"}
cmds["shell"]["sys"]["run"] = function(args)
    if current.objType == "shell" then comp = current.obj.host_computer
    if current.objType == "computer" then comp = current.obj

    r = false
    w = false
    x = false
	p = "/"
    n = false
    c = false
	for arg in args
		if arg == "-r" then r = true
		if arg == "-w" then w = true
		if arg == "-x" then x = true
        if arg.indexOf(":") then
			if arg.split(":")[0] == "-path" then
				path = arg.split(":")[1].replace("{", "").replace("}", "")
				folder = comp.File(path)
				if not folder then folder = comp.File(current.folder.path + path)
				if not folder then folder = comp.File(current.folder.path + "/" + path)
				if not folder then continue
				if not folder.is_folder then folder = folder.parent
				
				p = folder.path
			end if
            if arg.split(":")[0] == "-name" then n = arg.split(":")[1].replace("{", "").replace("}", "")
            if arg.split(":")[0] == "-cont" then c = arg.split(":")[1]
        end if
	end for
	

    output = "\n[#] PERMISSIONS OWNER GROUP SIZE TYPE PATH\n"
    out_files = {}
    root=comp.File(p)
	newFiles=[]
	newFiles=newFiles+root.get_folders+root.get_files
    i = 0
	while newFiles.len
		subFile=newFiles.pull
		if subFile.is_folder then newFiles=subFile.get_folders+subFile.get_files+newFiles
		if not subFile.is_folder and not subFile.get_folders then
			if r and not subFile.has_permission("r") then continue // search by permissions
			if w and not subFile.has_permission("w") then continue
			if x and not subFile.has_permission("x") then continue

            if n then // search by name
                if subFile.name.replace(n, "") == subFile.name then continue
            end if

            if c then // search by content
                if subFile.is_binary then continue
                if not subFile.has_permission("r") then continue
                ctn = true

                for str in subFile.get_content.split("\n")
                    if str != str.replace(c, "") then
                        ctn = false
                        break
                    end if
                end for
                if ctn then continue
            end if
            
            perms = subFile.permissions
            own = subFile.owner
            grp = subFile.group
            size = sys_cmds.reform_size(subFile.size)
            
            type = "txt"
            if subFile.name.split(".").len > 1 and subFile.name.split(".")[-1] == "src" then type = "src"
            if subFile.is_binary then type = "bin"

            output = output + "[" + i + "] [" + perms + "] [" + own + "] [" + grp + "] [" + size + "] <" + type + "> " + subFile.path + "\n"
            out_files = out_files + {str(i): subFile}
            i = i + 1
        end if
    end while

    return format_columns(output)

end function


cmds["shell"]["clog"] = {"name": "clog", "description": "clear log file", "args": ""}
cmds["shell"]["clog"]["run"] = function(args)

    if current.objType == "shell" then comp = current.obj.host_computer
    if current.objType == "computer" then comp = current.obj

	log = comp.File("/var/system.log")
	if log then
    	if comp.File("/var").has_permission("w") then
        	comp.touch("/var", "system.temp")
        	comp.File("/var/system.temp").move("/var", "system.log")
    	else
        	return print("permission diened")
    	end if
    	return print("log cleared")
	else
    	return print("logs not found")
	end if
end function


cmds["shell"]["chmod"] = {"name": "chmod", "description": "change permissions", "args": "[opt:-R] [u,g,o+wrx] [path file/folder]"}
cmds["shell"]["chmod"]["run"] = function(args)
    if args.len < 2 or (args.len == 3 and args[0] != "-R") then return

    permissions = args[0]
    pathFile = args[1]
    isRecursive = 0

    if args.len == 3 then
        permissions = args[1]
    	pathFile = args[2]
    	isRecursive = 1
    end if

    if current.objType == "shell" then comp = current.obj.host_computer
    if current.objType == "computer" then comp = current.obj

    file = comp.File(pathFile)
    if file == null then return print("chmod: can't find " + pathFile)
    output = file.chmod(permissions, isRecursive)
    if output then return output
end function

cmds["shell"]["chown"] = {"name": "chowd", "description": "change owner", "args": "[opt:-R] [owner] [path file/folder]"}
cmds["shell"]["chown"]["run"] = function(args)
    if args.len < 2 or (args.len == 3 and args[0] != "-R") then return

    owner = args[0]
    pathFile = args[1]
    isRecursive = 0

    if args.len == 3 then
        owner = args[1]
        pathFile = args[2]
        isRecursive = 1
    end if

    if current.objType == "shell" then comp = current.obj.host_computer
    if current.objType == "computer" then comp = current.obj

    file = comp.File(pathFile)
    if file == null then return print("chown: file not found: "+pathFile)
    output = file.set_owner(owner, isRecursive)
    if output then return output
end function

cmds["shell"]["chgrp"] = {"name": "chgrp", "description": "change group", "args": "[opt:-R] [group] [path file/folder]"}
cmds["shell"]["chgrp"]["run"] = function(args)
    if args.len < 2 or (args.len == 3 and args[0] != "-R") then return

    group = args[0]
    pathFile = args[1]
    isRecursive = 0

    if args.len == 3 then
        group = args[1]
        pathFile = args[2]
        isRecursive = 1
    end if

    if current.objType == "shell" then comp = current.obj.host_computer
    if current.objType == "computer" then comp = current.obj

    file = comp.File(pathFile)
    if file == null then return print("chgrp: file not found: "+pathFile)
    output = file.set_group(group, isRecursive)
    if output then return output
end function

cmds["shell"]["passwd"] = {"name": "passwd", "description": "change user password", "args": "[username]"}
cmds["shell"]["passwd"]["run"] = function(args)
    if args.len != 1 then return

    inputMsg = "Changing password for user " + args[0] +".\nNew password:"
    inputPass = user_input(inputMsg, true)

    if current.objType == "shell" then comp = current.obj.host_computer
    if current.objType == "computer" then comp = current.obj

    output = comp.change_password(args[0], inputPass)
    if output == true then return print("password modified OK")
    if output then return print(output)
    print("Error: password not modified")
end function

cmds["shell"]["up"] = {"name": "up", "description": "upload file into the remote shell", "args": "[local filepath] [remote dirpath]"}
cmds["shell"]["up"]["run"] = function(args)
    if args.len < 2 then return

    lpath = args[0]
    rpath = args[1]

    lfile = local.comp.File(lpath)
    if not lfile then lfile = local.comp.File(local.folder.path + lpath)
    if not lfile then lfile = local.comp.File(local.folder.path + "/" + lpath)
    if not lfile then return print("local: path not found - " + lpath)

    rdir = current.obj.host_computer.File(rpath)
    if not rdir then rdir = current.obj.host_computer.File(current.folder.path + rpath)
    if not rdir then rdir = current.obj.host_computer.File(current.folder.path + "/" + rpath)
    if not rdir then return print("remote: path not found - " + rpath)
    if not rdir.is_folder then rdir = rdir.parent

    local.shell.scp(lpath, rdir.path, current.obj)

    file = current.obj.host_computer.File(rdir.path + "/" + lfile.name)
    if file then return print("file uploaded") else return print("error")
end function

cmds["shell"]["dn"] = {"name": "dn", "description": "download file from the remote shell", "args": "[remote filepath] [local dirpath]"}
cmds["shell"]["dn"]["run"] = function(args)
    if args.len < 2 then return

    rpath = args[0]
    lpath = args[1]

    rfile = current.obj.host_computer.File(rpath)
    if not rfile then rfile = current.obj.host_computer.File(current.folder.path + rpath)
    if not rfile then rfile = current.obj.host_computer.File(current.folder.path + "/" + rpath)
    if not rfile then return print("remote: path not found - " + rpath)

    ldir = local.comp.File(lpath)
    if not ldir then ldir = local.comp.File(local.folder.path + lpath)
    if not ldir then ldir = local.comp.File(local.folder.path + "/" + lpath)
    if not ldir then return print("local: path not found - " + lpath)
    if not ldir.is_folder then ldir = ldir.parent

    current.obj.scp(rpath, ldir.path, local.shell)

    file = local.comp.File(ldir.path + "/" + rfile.name)
    if file then return print("file downloaded") else return print("error")
end function

cmds["shell"]["ssh"] = {"name": "ssh", "description": "remote ssh connection", "args": "[user] [pass] [ip] [opt: port]"}
cmds["shell"]["ssh"]["run"] = function(args)
    if args.len < 3 then return print("invalid args")

    ip = args[2]
    if not is_valid_ip(ip) then ip = nslookup(ip)
    if not is_valid_ip(ip) then return print("ip not found!")

    user = args[0]
    pass = args[1]
    if args.len > 3 and typeof(args[3].to_int) == "number" then port = args[3].to_int else port = 22

    print("Connecting...")
	if typeof(current.obj) == "shell" then 
    	shell = current.obj.connect_service(ip, port, user, pass, "ssh")
	else
		shell = local.shell.connect_service(ip, port, user, pass, "ssh")
	end if
    if typeof(shell) == "shell" then 
        router = get_router(ip)
        lan = router.ping_port(port).get_lan_ip
        new_obj = {"result": shell, "user": user, "ip": ip, "lan": lan, "target": port+"-"+router.port_info(router.ping_port(port)), "mem": "####", "val": "####"}
	    if not results[typeof(shell)].indexOf(new_obj) then results[typeof(shell)].push(new_obj) else return print("result already saved")
    else
        return print(shell)
    end if

	print("\nObtained:")
	for i in results
		print("<b> " + i.value.len + "</b> " + i.key + " objects")
	end for
	print()
end function

cmds["shell"]["ftp"] = {"name": "ftp", "description": "remote ftp connection", "args": "[user] [pass] [ip] [opt: port]"}
cmds["shell"]["ftp"]["run"] = function(args)
    if args.len < 3 then return print("invalid args")

    ip = args[2]
    if not is_valid_ip(ip) then ip = nslookup(ip)
    if not is_valid_ip(ip) then return print("ip not found!")

    user = args[0]
    pass = args[1]
    if args.len > 3 and typeof(args[3].to_int) == "number" then port = args[3].to_int else port = 21

    print("Connecting...")
	if typeof(current.obj) == "shell" then 
    	shell = current.obj.connect_service(ip, port, user, pass, "ftp")
	else
		shell = local.shell.connect_service(ip, port, user, pass, "ftp")
	end if
    if typeof(shell) == "shell" then 
        router = get_router(ip)
        lan = router.ping_port(port).get_lan_ip
        new_obj = {"result": shell, "user": user, "ip": ip, "lan": lan, "target": port+"-"+router.port_info(router.ping_port(port)), "mem": "####", "val": "####"}
	    if not results[typeof(shell)].indexOf(new_obj) then results[typeof(shell)].push(new_obj) else return print("result already saved")
    else
        return print(shell)
    end if

	print("\nObtained:")
	for i in results
		print("<b> " + i.value.len + "</b> " + i.key + " objects")
	end for
	print()
end function

cmds["shell"]["launch"] = {"name": "launch", "description": "launch program", "args": "[program] [*args]"}
cmds["shell"]["launch"]["run"] = function(args)
    if args.len == 0 then return print("invalid args")

    comp = current.obj.host_computer

    path = args[0]
    if args.len > 1 then launch_args = args[1:].join(" ") else launch_args = ""

    file = comp.File(path)
    if not file then file = comp.File(current.folder.path + path)
    if not file then file = comp.File(current.folder.path + "/" + path)
    if not file then file = comp.File("/bin/" + path)
    if not file then return print("file not found")

    out = current.obj.launch(file.path, launch_args)
    if typeof(out) == "string" then print(out)

end function




// computer commands
cmds["computer"]["help"] = {"name":"help", "description":"List all commands.", "args":""}
cmds["computer"]["help"]["run"] = function(args) //func that runs
	output = "\n" + "Computer Commands:" + "\n" //first line that needs to be print
	for command in cmds.computer //loop thru each command from Commands
		commandData = command.value //store command info in a var
		output = output + "		" + commandData.name + " " + commandData.args.trim + " -> " + commandData.description+"\n" //store info in output ready to be print
	end for
	print(output) //PRINT IT OUT
end function

cmds["computer"]["rh"] = cmds["shell"]["rh"]
cmds["computer"]["mrh"] = cmds["shell"]["mrh"]
cmds["computer"]["lh"] = cmds["shell"]["lh"]
cmds["computer"]["mlh"] = cmds["shell"]["mlh"]
cmds["computer"]["cd"] = cmds["shell"]["cd"]
cmds["computer"]["cd"] = cmds["shell"]["cd"]
cmds["computer"]["ls"] = cmds["shell"]["ls"]
cmds["computer"]["cat"] = cmds["shell"]["cat"]
cmds["computer"]["write"] = cmds["shell"]["write"]
cmds["computer"]["touch"] = cmds["shell"]["touch"]
cmds["computer"]["mkdir"] = cmds["shell"]["mkdir"]
cmds["computer"]["mv"] = cmds["shell"]["mv"]
cmds["computer"]["cp"] = cmds["shell"]["cp"]
cmds["computer"]["rm"] = cmds["shell"]["rm"]
cmds["computer"]["ps"] = cmds["shell"]["ps"]
cmds["computer"]["kill"] = cmds["shell"]["kill"]
cmds["computer"]["sys"] = cmds["shell"]["sys"]
cmds["computer"]["clog"] = cmds["shell"]["clog"]
cmds["computer"]["chmod"] = cmds["shell"]["chmod"]
cmds["computer"]["chown"] = cmds["shell"]["chown"]
cmds["computer"]["chgrp"] = cmds["shell"]["chgrp"]
cmds["computer"]["passwd"] = cmds["shell"]["passwd"]
cmds["computer"]["ssh"] = cmds["shell"]["ssh"]
cmds["computer"]["ftp"] = cmds["shell"]["ftp"]




// file commands
cmds["file"]["help"] = {"name":"help", "description":"List all commands.", "args":""}
cmds["file"]["help"]["run"] = function(args) //func that runs
	output = "\n" + "File Commands:" + "\n" //first line that needs to be print
	for command in cmds.file //loop thru each command from Commands
		commandData = command.value //store command info in a var
		output = output + "		" + commandData.name + " " + commandData.args.trim + " -> " + commandData.description+"\n" //store info in output ready to be print
	end for
	print(output) //PRINT IT OUT
end function

cmds["file"]["rh"] = cmds["shell"]["rh"]
cmds["file"]["mrh"] = cmds["shell"]["mrh"]
cmds["file"]["lh"] = cmds["shell"]["lh"]
cmds["file"]["mlh"] = cmds["shell"]["mlh"]
cmds["file"]["ssh"] = cmds["shell"]["ssh"]
cmds["file"]["ftp"] = cmds["shell"]["ftp"]

cmds["file"]["cd"] = {"name":"cd", "description":"change current path", "args":"[path]"}
cmds["file"]["cd"]["run"] = function(args)
    if args.len == 0 then
        while current.folder.name != "/"
            current.folder = current.folder.parent
        end while
        return
    end if

    path = args[0]

    if path[0] == "/" then
        while current.folder.name != "/"
            current.folder = current.folder.parent
        end while
	end if
	
    if path.len > 1 then
		if path[0] == "/" then path = path[1:]
        curfold = current.folder

        for fold in path.split("/")
            if fold == ".." then
                curfold = curfold.parent
            else
                temp = curfold
                for folder in curfold.get_folders
                    if fold == folder.name then
                        curfold = folder
                        break
                    end if
                end for
                if temp.path == curfold.path then return print("cd: path not found - " + path)
            end if
        end for
    current.folder = curfold
    end if

end function

cmds["file"]["ls"] = {"name":"ls", "description":"show all folders and files", "args":"[opt: path]"}
cmds["file"]["ls"]["run"] = function(args)
    curfold = current.folder
    if args.len > 0 then
        path = args[0]

        if path[0] == "/" then
            while curfold.name != "/"
                curfold = curfold.parent
            end while
        end if
        
        if path.len > 1 then
            if path[0] == "/" then path = path[1:]
    
            for fold in path.split("/")
                if fold == ".." then
                    curfold = curfold.parent
                else
                    temp = curfold
                    for folder in curfold.get_folders
                        if fold == folder.name then
                            curfold = folder
                            break
                        end if
                    end for
                    if temp.path == curfold.path then return print("ls: path not found - " + path)
                end if
            end for
        end if
    end if

    output = ["\n[#] TYPE NAME +RWX SIZE OWNER GROUP PERMISSIONS"]
    folders = curfold.get_folders
    files = curfold.get_files

    i = 1
    for f in folders + files
        name = f.name
        my_perms = ""
        if f.has_permission("r") then my_perms = my_perms + "R" else my_perms = my_perms + "-"
        if f.has_permission("w") then my_perms = my_perms + "W" else my_perms = my_perms + "-"
        if f.has_permission("x") then my_perms = my_perms + "X" else my_perms = my_perms + "-"
        perms = f.permissions
        size = sys_cmds.reform_size(f.size)
        owner = f.owner
        group = f.group
        perms = f.permissions

        type = "<TXT>"
        if f.is_binary then type = "<BIN>"
        if f.is_folder then type = "<DIR>"

        output.push("["+i+"] "+type+" "+name+" ["+my_perms+"] ["+size+"] ["+owner+"] ["+group+"] ["+perms+"]")

        i = i + 1
    end for
    return format_columns(output.join("\n")) + "\n"
end function

sys_cmds.get_file = function(p) // for file objects
    file = null
    name = p.split("/")[-1]
    curfold = current.folder

    if typeof(path.indexOf("/")) != "number" and path[0] != "/" then
        for f in curfold.get_files + curfold.get_folders
            if f.name == p then
                file = f
                break
            end if
        end for
		//print(1 + " - " + p)
        //if not file then return file
    end if

    if not file then
        path = parent_path(p)

        if path[0] == "/" then
            while curfold.name != "/"
                curfold = curfold.parent
            end while
        end if
		
        if path.len > 1 then
            if path[0] == "/" then path = path[1:]
    
            for fold in path.split("/")
                if fold == ".." then
                    curfold = curfold.parent
                else
                    temp = curfold
                    for folder in curfold.get_folders
                        if fold == folder.name then
                            curfold = folder
                            break
                        end if
                    end for
					//print(2 + " - " + curfold.path)
                    if temp.path == curfold.path then return file
					if curfold.path == p then return curfold
                end if
            end for
        end if
    end if
	
    for f in curfold.get_files + curfold.get_folders
        if f.name == name then
            file = f
            break
        end if
    end for
	//print(3 + " - " + p)
    return file
end function

cmds["file"]["cat"] = {"name":"cat", "description":"get file content", "args":"[path]"}
cmds["file"]["cat"]["run"] = function(args)
    if args.len == 0 then return print("cat: invalid args")

    path = args[0]
    file = sys_cmds.get_file(path)
    if not file then return print("cat: file not found - " + path)

    if not file.is_binary then
        if file.has_permission("r") then
            return file.get_content
        else
            return print("cat: permission denied")
        end if
    else
        return print("cat: file is binary")
    end if
end function

cmds["file"]["write"] = {"name":"write", "description":"set file content", "args":"[path] [*text]"}
cmds["file"]["write"]["run"] = function(args)
    if args.len == 0 then return print("cat: invalid args")

    path = args[0]
    if args.len > 1 then text = args[1:].join(" ").replace("\n", char(10)) else text = ""
    file = sys_cmds.get_file(path)
    if not file then return print("write: file not found - " + path)
    

    if not file.is_binary then
        if file.has_permission("w") then
            file.set_content(text)
        else
            return print("cat: permission denied")
        end if
    else
        return print("cat: file is binary")
    end if
end function

cmds["file"]["mv"] = {"name":"mv", "description":"move file", "args":"[path] [new path]"}
cmds["file"]["mv"]["run"] = function(args)
    if args.len <= 1 then return print("mv: invalid args")

    path = args[0]
    file = sys_cmds.get_file(path)
    if not file then return print("mv: file not found - " + path)

    npath = args[1]
    name = npath.split("/")[-1]
    npath = parent_path(npath)
    folder = sys_cmds.get_file(npath)
    if not folder then return print("mv: dir not found - " + npath)

    out = file.move(npath, name)
    if typeof(out) == "string" then return out
end function

cmds["file"]["cp"] = {"name":"cp", "description":"copy file", "args":"[path] [new path]"}
cmds["file"]["cp"]["run"] = function(args)
    if args.len <= 1 then return print("cp: invalid args")

    path = args[0]
    file = sys_cmds.get_file(path)
    if not file then return print("cp: file not found - " + path)

    npath = args[1]
    name = npath.split("/")[-1]
    npath = parent_path(npath)
    folder = sys_cmds.get_file(npath)
    if not folder then return print("cp: dir not found - " + npath)

    out = file.copy(npath, name)
    if typeof(out) == "string" then return out
end function

cmds["file"]["rm"] = {"name":"rm", "description":"remove file", "args":"[path]"}
cmds["file"]["rm"]["run"] = function(args)
    if args.len < 1 then return print("rm: invalid args")

    path = args[0]
    file = sys_cmds.get_file(path)
    if not file then return print("rm: file not found - " + path)

    out = file.delete
    if typeof(out) == "string" then return print(out)
    return print("file deleted")
end function

cmds["file"]["sys"] = {"name": "sys", "description": "shows all system files or searches for them by privileges/names/contents", "args": "[opt: -r -w -x -path:{str} -name:{str} -cont:{str}]"}
cmds["file"]["sys"]["run"] = function(args)
    if current.objType == "shell" then comp = current.obj.host_computer
    if current.objType == "computer" then comp = current.obj

    r = false
    w = false
    x = false
    p = current.folder
    while p.name != "/"
        p = p.parent
    end while
    n = false
    c = false
    for arg in args
        if arg == "-r" then r = true
        if arg == "-w" then w = true
        if arg == "-x" then x = true
        if arg.indexOf(":") then
            if arg.split(":")[0] == "-path" then
                path = arg.split(":")[1].replace("{", "").replace("}", "")
                folder = sys_cmds.get_file(path)
                if not folder.is_folder then folder = folder.parent
                
                p = folder.path
            end if
            if arg.split(":")[0] == "-name" then n = arg.split(":")[1].replace("{", "").replace("}", "")
            if arg.split(":")[0] == "-cont" then c = arg.split(":")[1]
        end if
    end for

    output = "\n[#] PERMISSIONS OWNER GROUP SIZE TYPE PATH\n"
    out_files = {}
    root=p
    newFiles=[]
    newFiles=newFiles+root.get_folders+root.get_files
    i = 0
    while newFiles.len
        subFile=newFiles.pull
        if subFile.is_folder then newFiles=subFile.get_folders+subFile.get_files+newFiles
        if not subFile.is_folder and not subFile.get_folders then
            if r and not subFile.has_permission("r") then continue // search by permissions
            if w and not subFile.has_permission("w") then continue
            if x and not subFile.has_permission("x") then continue

            if n then // search by name
                if subFile.name.replace(n, "") == subFile.name then continue
            end if

            if c then // search by content
                if subFile.is_binary then continue
                if not subFile.has_permission("r") then continue
                ctn = true

                for str in subFile.get_content.split("\n")
                    if str != str.replace(c, "") then
                        ctn = false
                        break
                    end if
                end for
                if ctn then continue
            end if
            
            perms = subFile.permissions
            own = subFile.owner
            grp = subFile.group
            size = sys_cmds.reform_size(subFile.size)
            
            type = "txt"
            if subFile.name.split(".").len > 1 and subFile.name.split(".")[-1] == "src" then type = "src"
            if subFile.is_binary then type = "bin"

            output = output + "[" + i + "] [" + perms + "] [" + own + "] [" + grp + "] [" + size + "] <" + type + "> " + subFile.path + "\n"
            out_files = out_files + {str(i): subFile}
            i = i + 1
        end if
    end while

    return format_columns(output)

end function

cmds["file"]["clog"] = {"name": "clog", "description": "copy the binary file instead of the log file", "args": ""}
cmds["file"]["clog"]["run"] = function(args)
    curfold = current.folder
    while curfold.name != "/"
        curfold = curfold.parent
    end while

    file = null
    folders = curfold.get_folders
    for fold in folders
        if fold.name != "lib" and fold.name != "boot" and fold.name != "sys" then continue
        files = fold.get_files
        if not files then continue
        file = files[0]
        if file then break
    end for

    out = file.copy("/var", "system.log")
    if typeof(out) == "string" then print(out) else print("log cleared")
end function


execute = function(input)
	input = input.trim
	add = false

    path = null
    if typeof(input.indexOf(">")) == "number" then
        path = input.split(">")[1].trim
        cmd = input.split(">")[0].trim.split(" ")
    else
        cmd = input.trim.split(" ")
    end if

    if cmd[0] != "&" then
		if cmd[0] != "<" and cmd[0] != "<<" then add = true 
        cmdName = cmd[0].lower  //get the first word as the command name
        args = cmd[1:] //get the rest of the words as the arguments
    else
        cmdName = cmd[1].lower  //get the first word as the command name
        args = cmd[2:] //get the rest of the words as the arguments
    end if
    if not cmds[current.objType].hasIndex(cmdName) then
		return print("Error: Command not found!") //print error
		add = false
	end if
    command = cmds[current.objType][cmdName] //get the command object
    if args.len > 0 then //if there are arguments
        if args[0] == "-h" or args[0] == "--help" then
            return print("Usage :" + command.name + " " + command.args.trim + " -> " + command.description + "\n") //print usage
        end if
    end if
	if add then memory.cmd_history.push(input)// add command to history

    output = command.run(args) //run the command
	if command.name == "help" then print("		& [command] -> don't save the command in memory")
    if command.name == "help" then print("		[command] > [file] -> save command output to file\n")

	if typeof(output) != "string" then return
    if output then print(output)
    output = output.replace("\n", char(10))

    if output and path then // add output to file
        file = local.comp.File(path)
        if not file then
            file = local.comp.File(parent_path(path))
            if file and file.is_folder then
                name = path.split("/")[-1]
                if file.has_permission("w") then
                    local.comp.touch(parent_path(path), name)
                    local.comp.File(path).set_content(output)
                else
                    return print("<b>can't save output: permission denied")
                end if
            else
                return print("<b>can't save output: dir not found")
            end if
        else
            if not file.is_binary then
                cont = ""
                if not file.has_permission("w") then return print("<b>can't save output: permission denied")
                if not file.has_permission("r") then
                    sure = user_input("<b>read permission denied. replace text in file? (y/n): ", false, true).lower
                    if sure != "y" then return
                    file.set_content(output)
                    return
                end if
                cont = file.get_content
				if cont.split("\n")[-1] != "" then cont = cont + char(10)
                file.set_content(cont + output + char(10))
            else
                return print("<b>can't save output: file is binary")
            end if
        end if
    end if

end function

main = function()
	while true
        ip = "0.0.0.0"
        lan = "0.0.0.0"
        if vars.show_ip then ip = current.ip
        if vars.show_lan then lan = current.lan
		print("<color=white>-</color><color=yellow>(</color>" + current.user + "<color=white>:</color><color=grey>" + current.objType + "</color><color=#ffbfbf>@</color>" + ip + "<color=white>~</color>" + lan + "<color=yellow>)</color><color=white>-</color>[" + current.folder.path + "]")
		if current.user == "root" then
			input = user_input("<color=white>-</color><color=red>#</color> ")
		else
			input = user_input("<color=white>-</color><color=yellow>$</color> ")
		end if
		execute(input)
	end while
end function

main
