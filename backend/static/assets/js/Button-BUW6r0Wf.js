import{j as r}from"./index-COQW48rg.js";import{r as p}from"./react-vendor-B_5cLHhr.js";import{R as h}from"./ui-vendor-BGr7ojqR.js";const u=p.memo(function({children:t,variant:i="primary",size:e="md",loading:a=!1,disabled:n=!1,icon:s,className:m="",...b}){const o={primary:"bg-primary-600 hover:bg-primary-500 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] hover:shadow-[0_0_20px_rgba(139,92,246,0.3)] border border-primary-500",secondary:"bg-dark-800 hover:bg-dark-700 text-dark-100 border border-dark-700/50",danger:"bg-red-600 hover:bg-red-500 text-white shadow-sm",success:"bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm",warning:"bg-amber-600 hover:bg-amber-500 text-white shadow-sm",info:"bg-cyan-600 hover:bg-cyan-500 text-white shadow-sm",blue:"bg-blue-600 hover:bg-blue-500 text-white shadow-sm",ghost:"bg-transparent hover:bg-dark-800 text-dark-400 hover:text-dark-100","ghost-primary":"bg-transparent hover:bg-primary-500/10 text-dark-400 hover:text-primary-400","ghost-danger":"bg-transparent hover:bg-red-500/10 text-dark-400 hover:text-red-400"},d={sm:"px-3 py-1.5 text-sm",md:"px-5 py-2.5",lg:"px-8 py-3.5 text-lg",icon:"p-2 aspect-square","icon-sm":"p-1.5 aspect-square"};return r.jsxs("button",{className:`
        relative overflow-hidden
        ${o[i]||o.primary}
        ${d[e]||d.md}
        rounded-xl font-medium transition-all duration-300 ease-out
        flex items-center justify-center gap-2
        disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none disabled:translate-y-0
        active:scale-[0.98]
        ${m}
      `,disabled:n||a,...b,children:[a?r.jsx(h,{size:e==="sm"?14:18,className:"animate-spin"}):s?r.jsx(s,{size:e==="sm"||e==="icon-sm"?14:18}):null,t&&r.jsx("span",{className:"relative z-10 flex items-center gap-2",children:t})]})});export{u as B};
