const template=
`
  <style>@import url("./scripts/components/weekcontainer/weekContainer.css")</style>
  <div class="container">
  </div>
`
class weekContainer extends HTMLElement{
  // static observedAttributes=["year"]

  set dates(dts){
    this._dates=dts
  }
  set data(data){
    this.buildDays(data)
  }

  constructor(){
    super()
    this.year
  }

  connectedCallback(){
    this.shadow=this.attachShadow({mode:"open"})
    this.shadow.innerHTML=template

    this.container=this.shadow.querySelector(".container")
    
    this.observer=new IntersectionObserver(this.catchDay,{
      threshold:.80
    })

    this.mounted=true
    this.setupListeners()
  }

  setupListeners(){
    this.container.addEventListener("change-day-state",ev=>{
      console.log(ev)
      for(let d of this.container.querySelectorAll("single-day")){
        console.log(d)
        d.setAttribute("format",ev.detail.targetState)
      }
      // setTimeout(()=>{ev.target.scrollIntoView({block:"center",inline:"center",behavior:"smooth"})},1000)
     
    })
  }

  catchDay(entries){
    let visibleDay=entries.find(el=>el.isIntersecting)
    if(visibleDay){
      //console.log(visibleDay.target.getAttribute("day"))
    }
  }

  // attributeChangedCallback(name, oldValue, newValue){
  //   switch(name){
  //     case "year":
  //       this.year=newValue
  //       break
  //     default: break
  //   }
  // }


  buildDays(data){
    let groupedData=new Map()
    for(let d of this._dates){
      groupedData.set(`${d}`,{records:[]})
    }

    for(let r of data){
      let recordDate=r.DATA_INIZIO.split("/").reverse().join("/")//dates in records are dd/mm/yyyy 
      if(groupedData.has(recordDate)) groupedData.set(recordDate,{records:[...groupedData.get(recordDate).records,r]})
    }

    this.container.innerHTML=""
    let startPadder=document.createElement("div")
    startPadder.classList.add("extremity-padder")
    startPadder.classList.add("compact")
    this.container.append(startPadder)
    
    let scrollToDay
    let i=0
    for(let d of groupedData){
      const day=document.createElement("single-day")
      day.setAttribute("format","compact")
      day.setAttribute("refDay",d[0])
      this.container.append(day)
      
      day.records=d[1]

      if(i<4){
        i++
        if(i==4) scrollToDay=day
      }
    }

    let endPadder=document.createElement("div")
    endPadder.classList.add("extremity-padder")
    endPadder.classList.add("compact")
    this.container.append(endPadder)

    console.log(scrollToDay)
    if(scrollToDay) setTimeout(()=>{scrollToDay.scrollIntoView({behavior:"instant",inline:"center"})},10)
  }

  disconnectedCallback(){
    this.observer.disconnect()
  }
}

customElements.define("week-container",weekContainer)