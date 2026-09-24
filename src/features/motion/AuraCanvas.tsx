import { useEffect, useRef } from 'react'
import * as THREE from 'three'

/**
 * O fundo abstrato do card de saudação, em WebGL.
 *
 * São três manchas de luz que se movem devagar — as mesmas do fundo em CSS,
 * que continua embaixo como base e como plano B. O desenho é um quadrado só
 * com um shader: nenhuma geometria, nenhuma luz, nenhuma textura. É o mínimo
 * que o Three.js precisa fazer para valer a pena estar aqui.
 *
 * O que impede isto de virar um custo permanente:
 *
 * - **Só entra quando é visto.** Um `IntersectionObserver` para o laço quando
 *   o card sai da tela, e o `visibilitychange` para quando a aba sai de foco.
 *   Um canvas desenhando atrás de uma aba escondida é bateria gasta em nada.
 * - **30 quadros por segundo, e não 60.** A animação é lenta de propósito; o
 *   dobro de quadros não muda o que se vê e dobra o trabalho da GPU.
 * - **Densidade de pixel limitada a 1,5.** Num monitor 4K, desenhar a 3x seria
 *   nove vezes mais pixels para uma mancha borrada.
 * - **Sem movimento, não monta.** Quem pediu menos movimento fica com o fundo
 *   em CSS, parado, que é o mesmo desenho.
 *
 * As cores saem das variáveis do tema, e não de constantes daqui: o dia em que
 * o acento mudar, isto muda junto.
 */

const VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`

const FRAGMENT = /* glsl */ `
  precision mediump float;

  varying vec2 vUv;
  uniform float uTempo;
  uniform float uProporcao;
  uniform vec3 uAcento;
  uniform vec3 uAcentoClaro;
  uniform vec3 uFrio;

  /* Uma mancha redonda e macia: 1 no centro, 0 na borda. */
  float mancha(vec2 uv, vec2 centro, float raio) {
    return smoothstep(raio, 0.0, distance(uv, centro));
  }

  void main() {
    /* Corrige a proporção para as manchas serem redondas, e não ovais. */
    vec2 uv = vec2(vUv.x * uProporcao, vUv.y);
    float t = uTempo * 0.08;

    vec2 c1 = vec2(uProporcao * 0.92 + sin(t * 1.10) * 0.10, 0.88 + cos(t * 0.90) * 0.07);
    vec2 c2 = vec2(uProporcao * 0.62 + cos(t * 0.70) * 0.12, 1.02 + sin(t * 1.30) * 0.06);
    vec2 c3 = vec2(uProporcao * 0.10 + sin(t * 0.80) * 0.08, -0.05 + cos(t * 0.60) * 0.06);

    float a = mancha(uv, c1, 0.75) * 0.55;
    float b = mancha(uv, c2, 0.55) * 0.34;
    float c = mancha(uv, c3, 0.70) * 0.42;

    vec3 cor = uAcento * a + uAcentoClaro * b + uFrio * c;
    float alfa = clamp(a + b + c, 0.0, 1.0) * 0.55;

    gl_FragColor = vec4(cor, alfa);
  }
`

/** Lê uma cor do tema, em hexadecimal, das variáveis CSS. */
function corDoTema(nome: string, padrao: string): THREE.Color {
  const valor = getComputedStyle(document.documentElement).getPropertyValue(nome).trim()
  return new THREE.Color(valor || padrao)
}

/** 30 quadros por segundo, em milissegundos. */
const INTERVALO = 1000 / 30

export default function AuraCanvas() {
  const hospedeiro = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const alvo = hospedeiro.current
    if (!alvo) return

    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: false,
        powerPreference: 'low-power',
      })
    } catch {
      // Sem WebGL — máquina antiga, driver bloqueado, aba sem aceleração. O
      // fundo em CSS continua lá, e ninguém vê falta.
      return
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
    renderer.setClearAlpha(0)
    renderer.domElement.setAttribute('aria-hidden', 'true')
    renderer.domElement.style.width = '100%'
    renderer.domElement.style.height = '100%'
    renderer.domElement.style.display = 'block'
    alvo.appendChild(renderer.domElement)

    const cena = new THREE.Scene()
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
    const uniforms = {
      uTempo: { value: 0 },
      uProporcao: { value: 1 },
      uAcento: { value: corDoTema('--accent', '#34d399') },
      uAcentoClaro: { value: corDoTema('--accent-soft', '#6ee7b7') },
      uFrio: { value: corDoTema('--limit-used', '#60a5fa') },
    }
    const material = new THREE.ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      uniforms,
      transparent: true,
      depthWrite: false,
    })
    const malha = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material)
    cena.add(malha)

    const medir = () => {
      const { clientWidth, clientHeight } = alvo
      if (clientWidth === 0 || clientHeight === 0) return
      renderer.setSize(clientWidth, clientHeight, false)
      uniforms.uProporcao.value = clientWidth / clientHeight
    }
    medir()

    const observadorDeTamanho = new ResizeObserver(medir)
    observadorDeTamanho.observe(alvo)

    let quadro = 0
    let ultimo = 0
    let relogio = 0
    let visivel = true
    let naTela = true

    const desenhar = (agora: number) => {
      quadro = requestAnimationFrame(desenhar)
      if (agora - ultimo < INTERVALO) return
      // O tempo anda pelo delta real, e não pelo relógio da página: assim a
      // animação não salta depois de a aba ficar minutos em segundo plano.
      relogio += Math.min(agora - ultimo, 100) / 1000
      ultimo = agora
      uniforms.uTempo.value = relogio
      renderer.render(cena, camera)
    }

    const avaliar = () => {
      const deveRodar = visivel && naTela
      if (deveRodar && quadro === 0) {
        ultimo = performance.now()
        quadro = requestAnimationFrame(desenhar)
      } else if (!deveRodar && quadro !== 0) {
        cancelAnimationFrame(quadro)
        quadro = 0
      }
    }

    const observadorDeTela = new IntersectionObserver((entradas) => {
      naTela = entradas.some((entrada) => entrada.isIntersecting)
      avaliar()
    })
    observadorDeTela.observe(alvo)

    const aoTrocarDeAba = () => {
      visivel = !document.hidden
      avaliar()
    }
    document.addEventListener('visibilitychange', aoTrocarDeAba)
    avaliar()

    return () => {
      if (quadro !== 0) cancelAnimationFrame(quadro)
      document.removeEventListener('visibilitychange', aoTrocarDeAba)
      observadorDeTela.disconnect()
      observadorDeTamanho.disconnect()
      malha.geometry.dispose()
      material.dispose()
      renderer.dispose()
      renderer.domElement.remove()
    }
  }, [])

  return <div ref={hospedeiro} className="absolute inset-0" />
}
