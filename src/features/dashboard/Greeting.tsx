import { useEffect, useState } from 'react'
import type { Profile, Transaction } from '@/domain/types'
import type { IsoDate } from '@/lib/date'

/**
 * A saudação segue o relógio de quem está lendo.
 *
 * Os cortes são os do português falado no Brasil: bom dia até o meio-dia, boa
 * tarde até as dezoito, boa noite depois. Não é o mesmo recorte de outros
 * idiomas, e traduzir "good evening" daria "boa tarde" às vinte horas.
 */
export function greetingFor(hour: number): string {
  if (hour < 12) return 'Bom dia'
  if (hour < 18) return 'Boa tarde'
  return 'Boa noite'
}

/**
 * Recalcula na virada da faixa horária.
 *
 * Um painel financeiro fica aberto por horas numa aba esquecida. Sem isto,
 * quem abriu às 11h50 continuaria vendo "Bom dia" no meio da tarde.
 */
export function useGreeting(): string {
  const [saudacao, setSaudacao] = useState(() => greetingFor(new Date().getHours()))

  useEffect(() => {
    const atualizar = () => setSaudacao(greetingFor(new Date().getHours()))
    const id = window.setInterval(atualizar, 60_000)
    return () => window.clearInterval(id)
  }, [])

  return saudacao
}

/**
 * Como a pessoa quer ser chamada.
 *
 * Prefere o apelido, se houver; senão, o primeiro nome. "Otávio de Souza
 * Oliveira" é o titular do cartão, mas ninguém quer ser cumprimentado assim.
 */
export function callNameOf(profile: Profile): string {
  const apelido = profile.nickname?.trim()
  if (apelido) return apelido
  return profile.name.trim().split(/\s+/)[0] ?? ''
}

/** Texto completo da saudação, ou string vazia quando ela está desligada. */
export function greetingTextFor(profile: Profile, hour: number): string {
  if (!profile.greeting) return ''
  const nome = callNameOf(profile)
  const saudacao = greetingFor(hour)
  return nome ? `${saudacao}, ${nome}!` : `${saudacao}!`
}

/**
 * A linha sob a saudação: o que hoje cobra.
 *
 * A data fica na folha de calendário ao lado; aqui vai o que ela significa. É
 * a única informação da tela com prazo, e vem do mesmo histórico que alimenta
 * "Ainda vence este mês" — lançamentos que já existem, sem previsão nem
 * estimativa, só contagem. Receita não "vence", então fica de fora.
 */
export function dueTodayText(transactions: readonly Transaction[], today: IsoDate): string {
  const vencendo = transactions.filter(
    (item) => item.kind !== 'income' && item.date === today,
  ).length

  if (vencendo === 0) return 'Nada vence hoje'
  return `${vencendo} ${vencendo === 1 ? 'lançamento vence' : 'lançamentos vencem'} hoje`
}
