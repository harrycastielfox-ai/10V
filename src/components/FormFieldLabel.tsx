import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const FIELD_HINTS: Record<string, string> = {
  PPE: "Número do Procedimento Policial Eletrônico usado para identificar e localizar o registro.",
  "Origem do registro":
    "Informa se o procedimento é novo, restaurado, relacionado a uma ocorrência ou importado de controle anterior.",
  "Nº do B.O.": "Número do boletim de ocorrência relacionado ao procedimento, quando existir.",
  "Nº Físico": "Número do procedimento ou volume físico mantido pela unidade, quando aplicável.",
  "Tipo de Procedimento":
    "Classificação formal do procedimento, como IP, APF, TCO, BOC, AAFAI, AIAI ou outro.",
  Visibilidade: "Define o nível de acesso ao registro. Use restrição para informações sensíveis.",
  "Data do Fato": "Data em que o fato investigado ocorreu.",
  "Data de Instauração": "Data em que o procedimento foi formalmente instaurado.",
  Prazo: "Data limite prevista para acompanhamento ou conclusão do procedimento.",
  Tipificação: "Enquadramento penal ou descrição jurídica principal do fato.",
  "Categoria do Caso": "Classificação criminal usada nos painéis, estatísticas e alertas do SIPI.",
  Situação: "Etapa administrativa atual do procedimento.",
  Elucidado:
    "Indica se a autoria do fato foi esclarecida. Não é sinônimo de relatório enviado ou procedimento concluído.",
  "Data da elucidação": "Data em que a elucidação do fato foi formalmente reconhecida.",
  "Houve arma de fogo?": "Indica se arma de fogo esteve vinculada ao fato investigado.",
  "Arma Utilizada": "Descrição da arma de fogo relacionada ao fato, quando conhecida.",
  "Autoria Determinada ou Indeterminada":
    "Informe se existe autoria conhecida ou se o responsável pelo fato ainda não foi identificado.",
  "Réu Preso": "Indica se há pessoa presa vinculada ao procedimento.",
  "Delegado Responsável": "Autoridade policial responsável pela condução do procedimento.",
  "Equipe Responsável": "Equipe policial encarregada do acompanhamento operacional.",
  Escrivão: "Servidor responsável pela escrituração ou acompanhamento formal do procedimento.",
  Bairro: "Bairro ou localidade principal vinculada ao fato.",
  Distrito: "Distrito, zona ou circunscrição territorial relacionada ao fato.",
  Motivação: "Contexto ou motivação relevante associada ao fato investigado.",
  "Vinculado a Facção": "Indica se há vínculo conhecido com organização criminosa.",
  "Nome da Facção": "Nome da organização criminosa vinculada, quando identificado.",
  "Status de Diligências": "Situação atual das diligências investigativas.",
  "Diligências Pendentes": "Ações investigativas que ainda precisam ser realizadas.",
  Observações: "Informações complementares importantes para o acompanhamento do procedimento.",
  "Medida Protetiva": "Indica se existe medida protetiva vinculada ao procedimento.",
  "Nº Processo da Medida": "Número judicial da medida protetiva relacionada.",
  "Situação do relatório": "Etapa atual do relatório: pendente, elaborado ou formalmente enviado.",
  "Data do relatório": "Data em que o relatório foi produzido ou concluído.",
  "Data de envio do relatório": "Data do encaminhamento formal do relatório.",
  "Representações Legais": "Quantidade de representações judiciais vinculadas ao procedimento.",
  Papel: "Participação da pessoa no procedimento, como vítima, investigado ou testemunha.",
  Nome: "Nome completo da pessoa envolvida.",
  "Observação da pessoa": "Informação específica sobre a participação desta pessoa no fato.",
  "Observação opcional": "Alcunha, condição ou outro detalhe relevante sobre esta pessoa.",
  "Possui inquérito vinculado?":
    "Selecione Sim quando a representação estiver ligada a um inquérito já cadastrado no SIPI.",
  "PPE vinculado / Procedimento relacionado":
    "Pesquise e selecione o procedimento ao qual esta representação pertence.",
  "Justificativa para representação sem inquérito vinculado":
    "Explique por que a representação é autônoma ou ainda não possui procedimento cadastrado.",
  "Processo judicial":
    "Número do processo judicial relacionado à representação, quando disponível.",
  "Tipo de Representação": "Natureza da medida judicial solicitada.",
  "Data da Representação": "Data em que a representação foi elaborada ou formalizada.",
  "Responsável pela Representação": "Servidor ou autoridade responsável pela elaboração da medida.",
  "Especificar representação": "Descreva o tipo quando a opção selecionada for Outro.",
  "Status da Representação": "Etapa atual da tramitação judicial da representação.",
  "Situação do cumprimento": "Informa se a decisão está pendente, em execução ou cumprida.",
  "Data de envio ao Judiciário": "Data em que a representação foi encaminhada ao Poder Judiciário.",
  "Vara / Juízo": "Órgão judicial responsável pela análise da representação.",
  "Data da decisão judicial": "Data em que a decisão foi proferida.",
  "Prazo concedido (dias)": "Quantidade de dias concedida pela decisão judicial para cumprimento.",
  "Data de vencimento": "Data final calculada ou informada para cumprimento da decisão.",
  "Observações da decisão": "Detalhes relevantes da decisão judicial.",
  Vítima: "Pessoa diretamente afetada pelo fato relacionado à representação.",
  "Investigado / Representado": "Pessoa contra quem a medida judicial é direcionada.",
  "Autor preso?": "Indica se a pessoa representada está presa.",
  "Prioridade operacional": "Nível de atenção necessário para acompanhamento da representação.",
  "Pedido sigiloso?": "Indica se a representação exige acesso restrito por sigilo.",
  "Equipe responsável": "Equipe encarregada do acompanhamento da representação.",
  "Acompanhamento especial?": "Marca representações que exigem monitoramento diferenciado.",
  "Observações internas": "Notas de uso interno que auxiliam o acompanhamento operacional.",
  "Resumo dos fatos": "Síntese objetiva dos fatos que fundamentam a representação.",
  "Fundamentação da medida": "Base fática e jurídica que sustenta o pedido judicial.",
  "Objetivo da representação": "Resultado pretendido com a medida solicitada.",
  "Diligências relacionadas": "Providências investigativas ligadas à representação.",
  "Data do cumprimento": "Data em que a decisão judicial foi executada.",
  "Equipe responsável pelo cumprimento":
    "Equipe que realizou ou acompanha o cumprimento da medida.",
  "Resultado do cumprimento": "Qualifica o resultado operacional da execução da medida.",
  "Observações do cumprimento": "Detalhes e ocorrências relevantes durante o cumprimento.",
};

type FormFieldLabelProps = {
  label: string;
  hint?: string;
  className?: string;
  uppercase?: boolean;
};

export function FormFieldLabel({ label, hint, className, uppercase = true }: FormFieldLabelProps) {
  const content = hint ?? FIELD_HINTS[label];
  const labelText = uppercase ? label.toUpperCase() : label;
  const labelClassName = cn(
    "mb-2 inline-flex text-xs font-bold tracking-wider text-muted-foreground",
    className,
  );

  if (!content) return <span className={labelClassName}>{labelText}</span>;

  return (
    <TooltipProvider delayDuration={120}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            tabIndex={0}
            className={cn(
              labelClassName,
              "cursor-help rounded-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border",
            )}
          >
            {labelText}
          </span>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          sideOffset={7}
          className="max-w-72 border border-primary/30 bg-popover px-3 py-2 text-[11px] font-medium leading-relaxed text-popover-foreground shadow-xl shadow-primary/10"
        >
          {content}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
