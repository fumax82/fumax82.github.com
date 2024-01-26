import { setListeners } from "./controls.js"
import { getData } from "./datamanager.js"
import { giornoSettimana } from "./utils.js"

const container=document.getElementById("container")

const togglaHorExp=(week, element)=>{
    console.log(week)
    for(let t of document.querySelectorAll(".tile")){
        if(t.getAttribute("week")==week && !t.classList.contains("verext")) t.classList.toggle("horext")
    }
    setTimeout(()=>{element.scrollIntoView({ behavior: "smooth", block: "end", inline: "center" })},450)
}

const togglaVerExp=(week, element)=>{
    for(let t of document.querySelectorAll(".tile")){
        if(t.getAttribute("week")==week && t.classList.contains("horext")) t.classList.toggle("verext")
    }
}

const createWeek=(week)=>{

    let row=document.createElement("div")
    row.setAttribute("week",week.label)
    row.classList.add("row")
    for(let d of week.days){
        console.log(week.label)
        let tile=document.createElement("div")
        tile.classList.add("tile")
        tile.setAttribute("week",week.label)
        
        //title
        let title=document.createElement("p")
        title.classList.add("title")
        title.innerHTML=d.day
        tile.append(title)

        for(let ev of d.events){
            let contenitoreImpegno=document.createElement("div")
            contenitoreImpegno.classList.add("item")

            let titolo=document.createElement("p")
            titolo.classList.add("title")
            titolo.innerHTML=ev.TITOLO
            contenitoreImpegno.append(titolo)

            let tags=document.createElement("p")
            tags.classList.add("tags")
            tags.innerHTML=ev.TAGS
            contenitoreImpegno.append(tags)

            tile.append(contenitoreImpegno)
        }

        setListeners(tile,{
            shortTap:()=>{togglaHorExp(week.label,tile)},
            longTap:()=>{togglaVerExp(week.label,tile)}
        })

        row.append(tile)
    }

    container.append(row)
}


async function costruisciMese(){
    let data=await getData()
    for(let sett of data) createWeek(sett)
}

costruisciMese()




//UTILS
function buildSingleEvent(ev){

}