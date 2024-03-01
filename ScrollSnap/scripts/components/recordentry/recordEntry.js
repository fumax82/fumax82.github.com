const template=`
  <style>@import url("./scripts/components/recordentry/recordEntry.css")</style>
  <div class="container">
  </div>
`
class recordEntry extends HTMLElement{
  // static observedAttributes=["id","value","cause"]
  set data(data){
    this._id=data.id
    this._date=data.DATA_INIZIO
    this._startHour=data.ORA_INIZIO
    this._endHour=data.ORA_FINE
    this._title=data.TITOLO

    this.setAttribute("id",`entry-${this._id}`)
    this.renderData()
  }

  set id(identity){
    this._id=identity
    this.setAttribute("id",`entry-${this._id}`)
  }
  get id(){return this._id}

  get date(){ return this._date}

  constructor(){
    super()
  }

  connectedCallback(){
    this.shadow=this.attachShadow({mode:"open"})
    this.shadow.innerHTML=template

    this.container=this.shadow.querySelector(".container")

    this.mounted=true
    // this.setupListeners()
    this.renderData()
  }

  setupListeners(){}

  // attributeChangedCallback(name, oldValue, newValue){
  //   switch(name){
  //     case "":
  //       break
  //     default: break
  //   }
  // }

  renderData(){
    if(this._id){
      this.container.innerHTML=""

      const title=document.createElement("div")
      title.classList.add("title")
      title.innerHTML=this._title
      this.container.append(title)

      //timebar
      const timeBar=document.createElement("div")
      timeBar.classList.add("time-bar")
      this.container.append(timeBar)
      
      //calculate position and length
      let totalMinutes=24*60 //using whole day
      let left=this.timeToMinutes(this._startHour)/totalMinutes
      let width=(this.timeToMinutes(this._endHour)-this.timeToMinutes(this._startHour))/totalMinutes

      const occupiedTime=document.createElement("div")
      occupiedTime.classList.add("occupied-time","hour-scale")
      timeBar.append(occupiedTime)
      occupiedTime.style=`clip-path:xywh(${left*100}% 0 ${width*100}% 100% round 4px);`


      const hourMargin="2px"
      const startTime=document.createElement("div")
      startTime.classList.add("explicit-time","start")
      startTime.innerHTML=this._startHour
      timeBar.append(startTime)
      startTime.style=`left:calc(${left*100}% - ${hourMargin});`

      const endTime=document.createElement("div")
      endTime.classList.add("explicit-time")
      endTime.innerHTML=this._endHour
      timeBar.append(endTime)
      endTime.style=`left:calc(${(left+width)*100}% + ${hourMargin});`
    }
  }

  disconnectedCallback(){

  }

  timeToMinutes(hhmm){
    let [h,m]=hhmm.split(":")
    return parseInt(h)*60 +parseInt(m)
  }
}

customElements.define("record-entry",recordEntry)