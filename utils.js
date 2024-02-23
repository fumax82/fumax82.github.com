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

// export const stringifyNumber=(value)=>{
// }