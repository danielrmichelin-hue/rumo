export const CHAVE_TEMA = "rumo-tema";

/** Roda no <head> antes da pintura: aplica o tema guardado (claro, escuro ou o do aparelho) sem piscar. */
export const SCRIPT_TEMA = `(function(){try{var t=localStorage.getItem("${CHAVE_TEMA}")||"auto";var e=t==="escuro"||(t==="auto"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.dataset.theme=e?"dark":"light"}catch(_){}})()`;
