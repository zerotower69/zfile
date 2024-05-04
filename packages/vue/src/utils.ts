/**
 * set HTMLElement attributes
 * @param el
 * @param attributes
 */
export function setAttributes(el:HTMLElement, attributes:Record<string, any>){
    Object.entries(attributes).forEach(([key,value])=>{
        el.setAttribute(key,value)
    })
}