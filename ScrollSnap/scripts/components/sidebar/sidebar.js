const template=
`
  <style>@import url("./scripts/components/sidebar/sidebar.css")</style>
  <div class="container">
  </div>
`
class mainSidebar extends HTMLElement{
  static observedAttributes=["open"]


  constructor(){
    super()
    this.setAttribute("open",false)
  }

  connectedCallback(){
    this.shadow=this.attachShadow({mode:"open"})
    this.shadow.innerHTML=template

    this.container=this.shadow.querySelector(".container")
    this.container.classList.remove("open")

    this.setupListeners()
    this.mounted=true
  }

  setupListeners(){
    window.addEventListener("toggle-main-sidebar",(ev)=>{
      if(this.getAttribute("open")=="true") this.setAttribute("open",false)
      else if(this.getAttribute("open")=="false") this.setAttribute("open",true)
    })
  }

  attributeChangedCallback(name, oldValue, newValue){
    switch(name){
      case "open":
        if(this.mounted) this.toggle(newValue)
        break
      default: break
    }
  }

  toggle(value){
    console.log(value)
    if(value=="true") this.container.classList.add("open")
    else this.container.classList.remove("open")
  }


  disconnectedCallback(){

  }
}

customElements.define("main-sidebar",mainSidebar)