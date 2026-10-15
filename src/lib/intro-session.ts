// Abertura da Home: decide, uma vez por sessão de navegação, se o vídeo da Ana deve tocar.
// A marcação acontece no início da reprodução (não no fim), para que atualizar a página ou
// voltar à Home logo depois não repita a abertura. Nenhum dado pessoal é armazenado.

export const INTRO_SESSION_KEY = "tm:intro-home";
export const INTRO_ATTRIBUTE = "data-intro";

type IntroStorage = Pick<Storage, "getItem" | "setItem">;

export type IntroEnvironment = {
  storage: IntroStorage | null;
  reducedMotion: boolean;
  saveData: boolean;
};

/** Reserva a abertura para esta sessão. Retorna true somente na primeira chamada da sessão. */
export function claimIntroPlayback({ storage, reducedMotion, saveData }: IntroEnvironment): boolean {
  if (reducedMotion || saveData || !storage) return false;
  try {
    if (storage.getItem(INTRO_SESSION_KEY)) return false;
    storage.setItem(INTRO_SESSION_KEY, "1");
    return true;
  } catch {
    return false;
  }
}

/** Lê o ambiente do navegador sem lançar erro (sessionStorage pode estar bloqueado). */
export function readIntroEnvironment(win: Window): IntroEnvironment {
  let storage: IntroStorage | null = null;
  try {
    storage = win.sessionStorage;
  } catch {
    storage = null;
  }
  const connection = (win.navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  return {
    storage,
    reducedMotion: Boolean(win.matchMedia?.("(prefers-reduced-motion: reduce)").matches),
    saveData: Boolean(connection?.saveData || /(^|-)2g$/.test(connection?.effectiveType ?? "")),
  };
}

/**
 * Script inline executado no <head> antes da primeira pintura. Em carregamentos completos da Home
 * ele reserva a sessão e marca o <html>, para que a camada da abertura apareça já no primeiro quadro,
 * sem a Home "piscar" antes. Espelha claimIntroPlayback + readIntroEnvironment.
 */
export const INTRO_BOOT_SCRIPT = `(function(){try{if(location.pathname!=="/")return;var w=window,c=navigator.connection;if(w.matchMedia&&w.matchMedia("(prefers-reduced-motion: reduce)").matches)return;if(c&&(c.saveData||/(^|-)2g$/.test(c.effectiveType||"")))return;var s=w.sessionStorage;if(s.getItem(${JSON.stringify(INTRO_SESSION_KEY)}))return;s.setItem(${JSON.stringify(INTRO_SESSION_KEY)},"1");document.documentElement.setAttribute(${JSON.stringify(INTRO_ATTRIBUTE)},"play")}catch(e){}})();`;
