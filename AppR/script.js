import { setListeners } from "./controls.js"

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

const createWeek=(week=undefined)=>{
    let row=document.createElement("div")
    row.setAttribute("week",week)
    row.classList.add("row")

    for(let i=0;i<7;i++){
        let tile=document.createElement("div")
        tile.classList.add("tile")
        tile.setAttribute("week",week)
        tile.innerHTML=`Giorno ${i} \n sett. ${week}`

        setListeners(tile,{
            shortTap:()=>{togglaHorExp(week,tile)},
            longTap:()=>{togglaVerExp(week,tile)}
        })

        row.append(tile)
    }

    container.append(row)
}

createWeek("A")
createWeek("B")
createWeek("C")