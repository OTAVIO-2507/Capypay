import type { AvatarImageId } from '@/domain/types'
import img1 from '@/assets/avatars/1.jpg'
import img2 from '@/assets/avatars/2.jpg'
import img3 from '@/assets/avatars/3.jpg'
import img4 from '@/assets/avatars/4.jpg'
import img5 from '@/assets/avatars/5.jpg'
import img6 from '@/assets/avatars/6.jpg'
import img7 from '@/assets/avatars/7.jpg'
import img8 from '@/assets/avatars/8.jpg'
import img9 from '@/assets/avatars/9.jpg'
import img10 from '@/assets/avatars/10.jpg'
import img11 from '@/assets/avatars/11.jpg'
import img12 from '@/assets/avatars/12.jpg'
import img13 from '@/assets/avatars/13.jpg'
import img14 from '@/assets/avatars/14.jpg'
import img15 from '@/assets/avatars/15.jpg'
import img16 from '@/assets/avatars/16.jpg'
import img17 from '@/assets/avatars/17.jpg'
import img18 from '@/assets/avatars/18.jpg'
import img19 from '@/assets/avatars/19.jpg'
import img20 from '@/assets/avatars/20.jpg'

/**
 * Os vinte retratos ilustrados, embutidos no aplicativo em 256×256.
 *
 * As artes de origem chegavam em ~2 MB cada — tamanho de geração, não de
 * avatar, que nunca aparece maior que 60px na tela. Redimensionadas e
 * recomprimidas para JPEG (nenhuma tem transparência: o fundo é sempre um
 * quadrado de cor sólida), as vinte juntas somam menos que uma única original.
 *
 * A ordem é a de chegada, e não uma curadoria: os dez primeiros já estavam
 * escolhidos por quem usa o app, e reordenar a lista trocaria o retrato de
 * todo mundo de uma vez.
 */
export const AVATAR_IMAGE_SRC: Record<AvatarImageId, string> = {
  '1': img1,
  '2': img2,
  '3': img3,
  '4': img4,
  '5': img5,
  '6': img6,
  '7': img7,
  '8': img8,
  '9': img9,
  '10': img10,
  '11': img11,
  '12': img12,
  '13': img13,
  '14': img14,
  '15': img15,
  '16': img16,
  '17': img17,
  '18': img18,
  '19': img19,
  '20': img20,
}

export const AVATAR_IMAGE_IDS: AvatarImageId[] = [
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '10',
  '11',
  '12',
  '13',
  '14',
  '15',
  '16',
  '17',
  '18',
  '19',
  '20',
]
