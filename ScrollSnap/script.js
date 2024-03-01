import { getWeekDates, getMonthDates } from "./scripts/utils.js"
import { addEntry, deleteEntry, getRecords, restoreDataFromDisk } from "./scripts/data/data.js"


// restoreDataFromDisk("base_dati_calendario.csv")
let data
data=await getRecords()

if(data){
  let refDay="2024/01/1"
  let weeks=getMonthDates(refDay)
  
  let monthData=[]
  for(let w of weeks){
    let weekEnd=w[6]
    let weekStart=w[0]
    let weekData=[]
    for(let d of data){
      let date=d.DATA_INIZIO.split("/").reverse().join("/")
      if(date>=weekEnd) break
      if(date>=weekStart) weekData.push(d)
    }
    monthData.push({dates:w,data:weekData})
  }

  
  let allWeeks=document.createElement("div")
  allWeeks.classList.add("content")
  allWeeks.style="display:flex;flex-direction:column;"
  document.body.append(allWeeks)
  for(let wd of monthData){
    let cont=document.createElement("week-container")
    cont.classList.add("content")
    allWeeks.append(cont)
    cont.dates=wd.dates
    cont.data=wd.data
  }
}