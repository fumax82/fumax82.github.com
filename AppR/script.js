import { setListeners } from "./controls.js"
import { getData } from "./datamanager.js"
import { giornoSettimana } from "./utils.js"

const container=document.getElementById("container")

const togglaHorExp=(week, element)=>{
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

const createWeek=(week=undefined,giorni)=>{
    console.log(giorni)
    let row=document.createElement("div")
    row.setAttribute("week",week)
    row.classList.add("row")

    for(let i=0;i<7;i++){
        let tile=document.createElement("div")
        tile.classList.add("tile")
        tile.setAttribute("week",week)
        tile.innerHTML=giornoSettimana(i)

        for(let imp of giorni[i].impegni){
            console.log(imp)
            let contenitoreImpegno=document.createElement("div")
            contenitoreImpegno.classList.add("item")

            let titolo=document.createElement("p")
            titolo.classList.add("title")
            titolo.innerHTML=imp.titolo
            contenitoreImpegno.append(titolo)

            let tags=document.createElement("p")
            tags.classList.add("tags")
            tags.innerHTML=imp.tags
            contenitoreImpegno.append(tags)

            tile.append(contenitoreImpegno)
        }

        setListeners(tile,{
            shortTap:()=>{togglaHorExp(week,tile)},
            longTap:()=>{togglaVerExp(week,tile)}
        })

        row.append(tile)
    }

    container.append(row)
}


async function costruisciMese(){
    let fakeData=await getData()
    for(let sett of fakeData) createWeek(sett.nome, sett.giorni)
}

costruisciMese()