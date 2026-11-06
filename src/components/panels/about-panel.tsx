import { Panel, PanelHeader } from "@/components/ui/panel";

/**
 * Explicação do serviço e dos limites de leitura.
 *
 * Fica num painel do dashboard em vez de uma seção de abertura: a atividade
 * parlamentar é o elemento central da página (PRD §9.2), e o convite ao
 * acompanhamento personalizado não pode prometer o que a Fase 3 ainda não fez.
 */
export function AboutPanel({ onOpenSearch }: { onOpenSearch?: () => void }) {
  return (
    <Panel>
      <PanelHeader
        title="Como ler esta página"
        caption="Você votou neles. Agora acompanhe o que eles votam."
      />

      <ul className="space-y-3 text-[13px] leading-relaxed text-text-muted">
        <li>
          Cada linha do feed é <strong className="font-medium text-text">uma votação</strong>,
          não uma proposta. Uma mesma proposta passa por várias votações ao
          longo da tramitação.
        </li>
        <li>
          O voto pode ser sobre uma emenda, um destaque ou o rito da sessão.
          Por isso <strong className="font-medium text-text">“Sim” não significa “a favor do projeto”</strong>:
          cada votação diz qual era o objeto exato.
        </li>
        <li>
          Resultado da votação, situação da proposição e voto do parlamentar são
          três fatos distintos, exibidos separadamente.
        </li>
        <li>
          Boa parte das votações da Câmara sai{" "}
          <strong className="font-medium text-text">sem voto individual publicado</strong>.
          Nesses casos o Observando não atribui voto a ninguém, e também não afirma
          que a votação foi simbólica.
        </li>
        <li>
          Quando não há registro de voto de um parlamentar, a página diz “sem
          registro” — isso não é ausência nem voto contrário.
        </li>
      </ul>

      <p className="mt-4 border-t border-border-subtle pt-3 text-[12px] leading-relaxed text-text-dim">
        O objetivo não é dizer se um deputado é bom ou ruim, mas dar acesso ao
        registro com contexto e fonte.
      </p>

      {onOpenSearch && (
        <button
          type="button"
          onClick={onOpenSearch}
          className="mt-4 w-full rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-contrast transition-colors hover:bg-accent-hover"
        >
          Buscar um deputado
        </button>
      )}
      <p className="mt-2 text-center text-[12px] text-text-dim">
        O acompanhamento por e-mail ainda está em construção.
      </p>
    </Panel>
  );
}
