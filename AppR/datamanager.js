
async function readJson(url){
	let impegni
	await fetch(url)
	.then(res=>res.json())
	.then(data=>impegni=data)
	return impegni
}

export async function getData(){
	let jsonData = await readJson("./dati.json")
	let settimane=[]
	let cursore=0
	for(let i=0;i<2;i++){//scorre le settimane
		let nomeSett=`Sett. ${i+1}`
		let giorni=[]
		for(let j=0;j<7;j++){
			let impegni=[]
			let quanti=Math.floor(Math.random()*4)
			for(let k=0;k<quanti;k++){
				if(cursore<jsonData.length){
					impegni.push(jsonData[cursore])
					cursore++
				}
			}
			giorni.push({
				data:j,
				impegni
			})
		}
		settimane.push({
			nome:nomeSett,
			giorni
		})
	}
	
	return settimane
}