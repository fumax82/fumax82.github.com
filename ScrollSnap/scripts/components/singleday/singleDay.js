const ADD_ENTRY_CONFIRM_EVENT="add-entry-confirm"
const DELETE_ENTRY_CONFIRM_EVENT="delete-entry-confirm"

const sanitizeNumber=(value)=>{
  return Math.floor(value*100)/100
}
const template=
`
  <style>@import url("./scripts/components/singleday/singleDay.css")</style>
  <div class="container compact">
    <div class="header"></div>
    <div class="header-hour-scale"></div>

    <div class="list"></div>

    <div class="spacer"></div>

    <button class="expand-button">&darr;</button>
  </div>
`
class singleDay extends HTMLElement{
  static observedAttributes=["format"]

  set records(data){
    this._records=data.records
    this.buildRows()
  }
  constructor(){
    super()
  }

  connectedCallback(){
    this.shadow=this.attachShadow({mode:"open"})
    this.shadow.innerHTML=template

    this.container=this.shadow.querySelector(".container")
    this.header=this.container.querySelector(".header")
    this.headerHourScale=this.container.querySelector(".header-hour-scale")
    this.list=this.container.querySelector(".list")

    this.mounted=true
    this.setupListeners()
  }

  setupListeners(){
    this.container.addEventListener("click",ev=>{
      let state=this.container && this.container.classList.contains("compact")?"compact":"medium"
      let targetState=state=="compact"?"medium":"compact"
      this.container.scrollIntoView({behavior:"smooth",block:"center",inline:"center"})
      setTimeout(()=>{
        let event=new CustomEvent("change-day-state",{detail:{targetState}})
        this.parentElement.dispatchEvent(event)
      },200)
    })
  }

  attributeChangedCallback(name, oldValue, newValue){
    switch(name){
      case "format":
        if(this.mounted){
          if(newValue=="compact"){
            this.container.classList.remove("medium")
            this.container.classList.add("compact")
          }else if(newValue=="medium"){
            this.container.classList.remove("compact")
            this.container.classList.add("medium")
          }
        }
        break
      default: break
    }
  }

  buildRows(){
    if(this._records!=undefined){
      const refSplitDate=this.getAttribute("refDay").split("/")//this comes in yyyy/mm/dd
      const refDate=new Date()
      refDate.setFullYear(parseInt(refSplitDate[0]))
      refDate.setMonth(parseInt(refSplitDate[1])-1)
      refDate.setDate(parseInt(refSplitDate[2]))

      let dayName=refDate.toLocaleDateString("it",{weekday:"long"})
      let dayNameShort=refDate.toLocaleDateString("it",{weekday:"short"})
      let monthName=refDate.toLocaleDateString("it",{month:"long"})

      this.header.innerHTML=`${dayNameShort}, ${refSplitDate[2]} ${monthName}`

      this.list.innerHTML=""
      for(let r of this._records){
        let entry=document.createElement("record-entry")
        entry.classList.add("entry")
        this.list.append(entry)
        entry.data=r
      }
    }else{
      let entry=document.createElement("div")
      entry.classList.add("entry")
      entry.innerHTML="Nessun impegno"
      this.list.append(entry)
    }
  }


  addEntry(record){
    console.log("ADD ENTRY ",record)
    this._records.push(record)
    this.updateTotals()
    
    let entry=document.createElement("budget-entry")
    entry.classList.add("entry")
    entry.data=record

    let i=0
    console.log(this.list.children.length)
    while(i<this.list.children.length){
      console.log(this.list.children[i].date,record.date)
      if(this.list.children[i].date>record.date) break
      i++
    }
    if(i<this.list.children.length) this.list.children[i].insertAdjacentElement("afterend",entry)
    else this.list.append(entry)
  }

  sortRecords(){
    this._records.sort((a,b)=>{
      let dateA=new Date(a.date)
      let dateB=new Date(b.date)
      return dateA-dateB
    })
  }
}

customElements.define("single-day",singleDay)