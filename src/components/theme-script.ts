export const THEME_KEY = "catholica.theme";
export const TEXT_SCALE_KEY = "catholica.textScale";

/** Runs before first paint to avoid a flash of the wrong theme / text size. */
export const THEME_INIT_SCRIPT = `(function(){try{
var d=document.documentElement,t=localStorage.getItem('${THEME_KEY}');
if(t!=='light'&&t!=='dark'){t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}
d.setAttribute('data-theme',t);
var s=parseFloat(localStorage.getItem('${TEXT_SCALE_KEY}'));
if(s>=0.9&&s<=1.5){d.setAttribute('data-text-scale',String(s));d.style.setProperty('--text-scale',String(s));}
}catch(e){}})();`;
