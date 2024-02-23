import { addEntry, deleteEntry, getRecords, restoreDataFromDisk } from "./scripts/data/data.js"


// restoreDataFromDisk("base_dati_calendario.csv")
let data
data=await getRecords()

if(data){
  let weekStart="2024/01/15"
  let weekEnd="2024/01/22"
  let weekData=[]
  for(let d of data){
    let date=d.DATA_INIZIO.split("/").reverse().join("/")
    if(date>=weekStart) weekData.push(d)
    if(date>=weekEnd) break
  }
  
  let cont=document.createElement("week-container")
  cont.classList.add("content")
  document.body.append(cont)
  cont.data=weekData
}