export const getMonthLength=(month,year)=>{
  switch(month){
    case 3:
    case 5:
    case 6:
    case 10:
      return 30
    case 1:
      let date=new Date()
      date.setFullYear(year)
      date.setMonth(month)
      date.setDate(29)
      if(date.getMonth()==month) return 29
      else return 28
    default: return 31
  }
}

export const sanitizeNumber=(value)=>{
  return Math.floor(value*100)/100
}

export const dateToYyyyMmDd=(date)=>{
  return `${date.getFullYear()}/${(date.getMonth()+1).toString().padStart(2,"0")}/${date.getDate().toString().padStart(2,"0")}`
}

export const getMonthDates=(date)=>{
  let d=new Date(date)
  d.setDate(1)
  let refDays=[]
  for(let i=0;i<5;i++){
    let ref=new Date(d)
    ref.setDate(ref.getDate()+i*7)
    refDays.push(dateToYyyyMmDd(ref))
  }
  return refDays.map(el=>getWeekDates(el))
}

export const getWeekDates=(date)=>{
  let d=new Date(date)
  let day=d.getDay()//0 is sunday
  let shift=day==0?6:day-1
  
  let dates=[]
  for(let i=0;i<7;i++){
    let shifted=new Date(d)
    shifted.setDate(shifted.getDate()-shift+i)
    dates.push(dateToYyyyMmDd(shifted))
  }
  return dates
}