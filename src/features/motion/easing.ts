import gsap from 'gsap'
import { CustomEase } from 'gsap/CustomEase'

gsap.registerPlugin(CustomEase)

/**
 * A curva de saída do sistema, para o GSAP.
 *
 * É a mesma `cubic-bezier(0.16, 1, 0.3, 1)` que o CSS já usa no popover, no
 * painel lateral e no balão do tour. Uma biblioteca de animação nova não traz
 * curva nova: duas curvas de saída no mesmo produto se notam quando dois
 * elementos entram lado a lado, e ninguém sabe dizer por quê.
 */
export const SAIDA = CustomEase.create('capy-saida', '0.16, 1, 0.3, 1')
