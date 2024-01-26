
async function readFromFile(url){
	let impegni
	await fetch(url)
	.then(res=>res.text())
	.then(data=>impegni=data)

	let rows=impegni.split("\r\n")

	rows=rows.map(el=>el.split(";"))
	rows=rows.filter(el=>el[0]!="")

	let keyNames=rows.shift(rows)
	keyNames=keyNames.filter(el=>el!="")
	
	let data=[]

	for(let r of rows){
		let entry=new Map()
		for(let [i,k] of keyNames.entries()){
			if(k=="DATA_INIZIO" || k=="DATA_FINE") entry.set(k,r[i].split("/").reverse().join("/"))
			else entry.set(k,r[i])
		}
		data.push(entry)
	}

	return data
}

export async function getData(){
	let data = await readFromFile("./base_dati_calendario.csv")
	
	let days=new Map()
	for(let item of data){
		let date=item.get("DATA_INIZIO")
		if(!days.has(date)){
			days.set(date,{events:[item]})
		}else{
			let existing=days.get(date).events
			days.set(date,{events:[...existing,item]})
		}
	}
	
	
	//get first week
	let firstDateString=days.keys().next().value
	let weeks=[]
	let startDay=new Date(firstDateString)
	
	for(let i=0;i<4;i++){
		startDay.setDate(startDay.getDate()+i*7)
		let week=[]
		let weekDates=getWeekObject(startDay)
		//load events
		for(let d of weekDates){
			week.push({day:d,events:days.has(d)?days.get(d).events.map(el=>Object.fromEntries(el)):[]})
		}
		weeks.push({label:`Sett. ${i}`,days:week})
	}

	return weeks
}


function getWeekObject(refDay){
	let week=[]
	for(let i=0;i<7;i++){
		let day=getWeekByDay(refDay)
		day.setDate(day.getDate()+i)
		week.push(dateToYYYYMMDD(day))
	}
	return week
}

function getWeekByDay(refDay){
	let firstDate=new Date(refDay)
	
	let dayShift=firstDate.getDay()==0?6:firstDate.getDay()-1
	

	let startOfWeek=new Date(firstDate)
	startOfWeek.setDate(startOfWeek.getDate()-dayShift)
	return startOfWeek
}

function dateToYYYYMMDD(date){
	return `${date.getFullYear()}/${(date.getMonth()+1).toString().padStart(2,"0")}/${(date.getDate()).toString().padStart(2,"0")}`
}