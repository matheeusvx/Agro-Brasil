import 'production_data.dart';
import 'logistics_data.dart';
import 'water_data.dart';

const humanDecision =
    'A decisão final é humana. Confira os registros e o contexto local antes de agir. Nenhuma ação é executada por este aviso.';

class ExplainedAlert {
  final String id,
      title,
      attention,
      kind,
      reason,
      evidence,
      confidence,
      limitations;
  final bool outdated;
  const ExplainedAlert({
    this.outdated = false,
    required this.id,
    required this.title,
    required this.attention,
    required this.kind,
    required this.reason,
    required this.evidence,
    required this.confidence,
    required this.limitations,
  });
}

/// Confidence describes evidence quality, never a probability of a future event.
ExplainedAlert waterAlert(WaterSnapshot data, WaterMonth month) {
  final reference = data.references
      .where((r) => r.month == month.date.month)
      .firstOrNull;
  final threshold = data.thresholds
      .where(
        (t) => t.indicator == 'monthly_rain' && t.month == month.date.month,
      )
      .firstOrNull;
  final rain = month.rain, mean = reference?.mean;
  final valid =
      rain != null &&
      rain.isFinite &&
      rain >= 0 &&
      mean != null &&
      mean.isFinite &&
      mean > 0 &&
      threshold != null &&
      [
        threshold.q10,
        threshold.q25,
        threshold.q75,
        threshold.q90,
      ].every((v) => v.isFinite && v >= 0) &&
      threshold.q10 <= threshold.q25 &&
      threshold.q25 <= threshold.q75 &&
      threshold.q75 <= threshold.q90;
  final below = valid && rain < mean;
  final low = valid && rain < threshold.q25;
  return ExplainedAlert(
    id: 'water-${month.date.toIso8601String()}',
    title: !valid
        ? 'Comparação histórica indisponível'
        : below
        ? 'Chuva abaixo da média histórica'
        : 'Chuva sem sinal abaixo da média',
    attention: !valid
        ? 'Dados insuficientes'
        : low
        ? 'Atenção'
        : 'Informativo',
    kind: 'Aviso histórico',
    reason: !valid
        ? 'Faltam valores ou referências válidas para comparar este mês.'
        : 'O acumulado mensal foi comparado à média do mesmo mês em 2000–2019. ${waterLevel(threshold.classify(rain))}. Atenção quando o acumulado está abaixo de Q25 (limite estrito). Os quantis descrevem a distribuição histórica; não são probabilidades de seca.',
    evidence:
        'Indicador: precipitação mensal · ${waterNumber(rain)} mm. Média: ${waterNumber(mean)} mm. '
        'Q10: ${waterNumber(threshold?.q10)} mm; Q25: ${waterNumber(threshold?.q25)} mm. '
        'Período: ${waterDate(month.date)} a ${waterDate(month.end)} (LST). '
        'Fonte: NASA POWER · AGUA-04 · Mogi das Cruzes/SP. Pacote histórico até ${waterDate(data.dataAsOf)}; referência: ${reference?.sampleYears ?? 0} anos.',
    confidence: valid && reference?.sampleYears == 20
        ? 'Moderada para comparação histórica: referência de 20 anos e regra determinística. Sem confiança estabelecida para decisões na propriedade ou previsão.'
        : 'Baixa: dados ou amostra de referência insuficientes.',
    limitations: 'Pacote local retrospectivo, disponível offline; não contém condições atuais. Grade regional, sem medição na propriedade. Não é previsão operacional de seca ou escassez. Não considera solo, irrigação ou disponibilidade de água. Previsão experimental não é utilizada neste aviso.',
  );
}

String alertTime(DateTime value) => '${value.toUtc().toIso8601String()} (UTC)';

String _creationEvidence(List<Map<String, dynamic>> orders) {
  final dates =
      orders
          .map((o) => DateTime.tryParse(o['createdAt'] as String? ?? ''))
          .whereType<DateTime>()
          .toList()
        ..sort();
  if (dates.isEmpty) return 'não informadas.';
  return '${alertTime(dates.first)} a ${alertTime(dates.last)}; '
      '${orders.length - dates.length} sem data válida.';
}

class AlertContext {
  final String scope, property;
  final DateTime now;
  final bool offline, demonstration;
  const AlertContext({
    required this.scope,
    required this.property,
    required this.now,
    this.offline = false,
    this.demonstration = false,
  });
  bool stale(DateTime fetched) =>
      offline ||
      now.difference(fetched) > const Duration(minutes: 15) ||
      fetched.isAfter(now);
  String confidence(DateTime fetched) => stale(fetched) || demonstration
      ? 'Baixa: ${demonstration ? 'registros de demonstração' : 'cópia offline, consulta antiga ou relógio inconsistente'}. Não comprova a situação atual; confirme com a fonte.'
      : 'Moderada: regra determinística sobre registros autorizados consultados nesta sessão. Depende da atualização e correção dos registros; não é probabilidade de evento futuro.';
  String source(DateTime fetched) =>
      'Fonte: ${demonstration ? 'demonstração fictícia Agro+ Brasil' : 'API Agro+ Brasil, registros autorizados da propriedade'}. Consulta: ${alertTime(fetched)}. ${stale(fetched) ? 'Dados desatualizados; situação atual não confirmada.' : 'Retrato da consulta; pode mudar após a leitura.'}';
}

List<ExplainedAlert> productionAlerts(
  ProductionSnapshot data,
  AlertContext context,
) {
  if (data.scope != context.scope || data.property != context.property) {
    return [];
  }
  // Evaluate saved snapshots at consultation time, never as current stock.
  final at = context.stale(data.fetchedAt) ? data.fetchedAt : context.now;
  final summary = ProductionSummary(data, at);
  final source = context.source(data.fetchedAt);
  final confidence = context.confidence(data.fetchedAt);
  const limits =
      'Somente ofertas vinculadas aos lotes desta propriedade. Produção registrada não é excedente. Saldo e vencimento não comprovam perda ou desperdício. A janela de 3 dias é uma regra de atenção da interface, não prazo previsto. Atualize antes de decidir.';
  final result = <ExplainedAlert>[];
  if (summary.expiring.isNotEmpty) {
    final first = summary.expiring.first;
    result.add(
      ExplainedAlert(
        id: 'expiring',
        outdated: context.stale(data.fetchedAt),
        title: 'Ofertas próximas do vencimento',
        attention: 'Atenção',
        kind: 'Atenção operacional',
        reason: 'Há ofertas PUBLICADA com saldo positivo e vencimento posterior à avaliação, em até 3 dias (72 horas, limite inclusivo).',
        evidence:
            'Indicador: ofertas próximas do vencimento · ${summary.expiring.length}. Primeiro vencimento: ${first['availableUntil']}. Avaliação: ${alertTime(at)}. $source',
        confidence: confidence,
        limitations: limits,
      ),
    );
  }
  if (summary.pending.isNotEmpty) {
    result.add(
      ExplainedAlert(
        id: 'pending',
        outdated: context.stale(data.fetchedAt),
        title: 'Solicitações pendentes de aceite',
        attention: 'Atenção',
        kind: 'Atenção operacional',
        reason: 'Os pedidos vinculados às ofertas desta propriedade estão no estado SOLICITADO. O estado não indica atraso.',
        evidence:
            'Indicador: pedidos SOLICITADO · ${summary.pending.length}. Situação na consulta. $source',
        confidence: confidence,
        limitations: limits,
      ),
    );
  }
  final balance = summary.sale + summary.donation;
  if (balance > 0) {
    result.add(
      ExplainedAlert(
        id: 'available',
        outdated: context.stale(data.fetchedAt),
        title: 'Saldo disponível em ofertas',
        attention: 'Informativo',
        kind: 'Atenção operacional',
        reason: 'Soma dos saldos availableKg de ofertas PUBLICADA ainda válidas na avaliação. Não usa a produção total como excedente.',
        evidence:
            'Indicador: saldo ofertado · ${waterNumber(balance / 1000, decimals: 3)} kg. Avaliação: ${alertTime(at)}. $source',
        confidence: confidence,
        limitations: limits,
      ),
    );
  }
  return result;
}

List<ExplainedAlert> logisticsAlerts(
  LogisticsSnapshot data,
  AlertContext context,
) {
  if (data.scope != context.scope || data.property != context.property) {
    return [];
  }
  final summary = LogisticsSummary(data);
  const titles = {
    'SOLICITADO': 'Pedidos aguardando aceite',
    'ACEITO': 'Pedidos aguardando retirada',
    'RETIRADO': 'Pedidos aguardando recebimento',
  };
  return [
    for (final status in logisticsOpenStatuses)
      if (summary.byStatus[status]!.isNotEmpty)
        ExplainedAlert(
          id: 'logistics-$status',
          outdated: context.stale(data.fetchedAt),
          title: titles[status]!,
          attention: 'Atenção',
          kind: 'Atenção operacional',
          reason: switch (status) {
            'SOLICITADO' =>
              'O estado SOLICITADO registra pedidos ainda sem aceite.',
            'ACEITO' => 'O estado ACEITO indica retirada ainda não registrada. Quando há cooperativa designada, ela conduz a próxima etapa.',
            _ => 'O estado RETIRADO indica que falta confirmação de recebimento pelo destinatário; não é tarefa de confirmação do produtor.',
          },
          evidence:
              'Indicador: pedidos $status · ${summary.byStatus[status]!.length}. Situação na consulta. '
              'Período de criação registrado: ${_creationEvidence(summary.byStatus[status]!)} '
              '${context.source(data.fetchedAt)}',
          confidence:
              summary.byStatus[status]!.any(
                (o) =>
                    DateTime.tryParse(o['createdAt'] as String? ?? '') == null,
              )
              ? 'Baixa: há pedido sem data de criação válida; situação baseada somente no estado registrado. ${context.confidence(data.fetchedAt)}'
              : context.confidence(data.fetchedAt),
          limitations: 'Data de criação não é horário de aceite, retirada ou recebimento. Datas ausentes não são estimadas. Não há prazo contratado, atraso comprovado, rota ou previsão de chegada neste aviso. Estados podem mudar após a consulta. Confirme com o responsável pela próxima etapa.',
        ),
  ];
}
