const template=
`
  <style>@import url("./scripts/components/toolbar/toolbar.css")</style>
  <div class="container">
    <button class="sidebar-button">Toggla</div>
  </div>
`
class mainSidebar extends HTMLElement{
  // static observedAttributes=["open"]

  constructor(){
    super()
  }

  connectedCallback(){
    this.shadow=this.attachShadow({mode:"open"})
    this.shadow.innerHTML=template

    this.container=this.shadow.querySelector(".container")
    this.sidebarButton=this.container.querySelector(".sidebar-button")

    this.setupListeners()
    this.mounted=true
  }

  setupListeners(){
    this.sidebarButton.addEventListener("click",(ev)=>{
      let event=new Event("toggle-main-sidebar")
      window.dispatchEvent(event)
    })
  }

  // attributeChangedCallback(name, oldValue, newValue){
  //   switch(name){
  //     case "open":
  //       if(this.mounted) this.toggle(newValue)
  //       break
  //     default: break
  //   }
  // }

  disconnectedCallback(){

  }
}

customElements.define("main-toolbar",mainSidebar)