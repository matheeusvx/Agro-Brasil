import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../design.dart';
import 'dashboard_components.dart';
import 'water_data.dart';

class WaterDashboard extends StatefulWidget {
  final Future<WaterSnapshot> Function()? load;
  const WaterDashboard({super.key, this.load});
  @override
  State<WaterDashboard> createState() => _WaterDashboardState();
}

class _WaterDashboardState extends State<WaterDashboard> {
  late Future<WaterSnapshot> _snapshot;
  @override
  void initState() {
    super.initState();
    _snapshot = _load();
  }

  Future<WaterSnapshot> _load() =>
      (widget.load ?? const WaterRepository().load)();
  void _retry() => setState(() {
    _snapshot = _load();
  });

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      toolbarHeight: MediaQuery.textScalerOf(context).scale(18) > 27 ? 88 : 64,
      title: const Text('Chuvas na sua região', maxLines: 2),
    ),
    body: FutureBuilder<WaterSnapshot>(
      future: _snapshot,
      builder: (context, state) {
        if (state.connectionState == ConnectionState.done &&
            state.hasData &&
            state.data!.months.isNotEmpty) {
          return _WaterContent(snapshot: state.data!);
        }
        final status = state.hasError
            ? DashboardStatus.error
            : state.connectionState == ConnectionState.done
            ? DashboardStatus.empty
            : DashboardStatus.loading;
        return ListView(
          padding: const EdgeInsets.all(20),
          children: [
            const TerritorialHeader(
              municipality: 'Mogi das Cruzes/SP',
              source: 'NASA POWER',
              period: 'Histórico regional 2000–2025',
            ),
            const SizedBox(height: 20),
            DashboardStateView(
              status: status,
              message: switch (status) {
                DashboardStatus.loading =>
                  'Lendo os arquivos históricos incluídos no aplicativo.',
                DashboardStatus.error => 'O pacote local está ausente ou incompatível. Tente reabrir. Nenhum valor foi substituído por zero.',
                _ => 'Este pacote não contém meses disponíveis para consulta.',
              },
              onRetry: status == DashboardStatus.loading ? null : _retry,
            ),
          ],
        );
      },
    ),
  );
}

class _WaterContent extends StatefulWidget {
  final WaterSnapshot snapshot;
  const _WaterContent({required this.snapshot});
  @override
  State<_WaterContent> createState() => _WaterContentState();
}

class _WaterContentState extends State<_WaterContent> {
  WaterSnapshot get data => widget.snapshot;
  late int year, month, day;
  int series = 0;
  WaterMonth get current => data.months.firstWhere(
    (m) => m.date.year == year && m.date.month == month,
  );
  List<WaterDay> get monthDays => data.days
      .where((d) => d.date.year == year && d.date.month == month)
      .toList();
  WaterDay? get reading => data.dayAt(DateTime(year, month, day));

  @override
  void initState() {
    super.initState();
    final latest = data.months.last;
    year = latest.date.year;
    month = latest.date.month;
    day = latest.end.day;
  }

  void selectMonth(int nextMonth) => setState(() {
    month = nextMonth;
    day = current.end.day;
  });
  void selectYear(int nextYear) => setState(() {
    year = nextYear;
    final available = data.months.where((m) => m.date.year == year).toList();
    if (!available.any((m) => m.date.month == month)) {
      month = available.last.date.month;
    }
    day = current.end.day;
  });

  @override
  Widget build(BuildContext context) {
    final selectedMonth = current;
    final reference = data.reference(month);
    final yearMonths = data.months.where((m) => m.date.year == year).toList();
    final daily = monthDays;
    final selectedDate = DateTime.utc(year, month, day);
    final dayReading = reading;
    final seriesTitle = [
      'Acumulado de 7 dias',
      'Acumulado de 30 dias',
      'Sequência de baixa chuva',
    ][series];
    final unit = series == 2 ? 'dias' : 'mm';
    double? seriesValue(WaterDay d) => switch (series) {
      0 => d.rain7,
      1 => d.rain30,
      _ => d.dryRun,
    };
    final anomaly = selectedMonth.anomalyPercent;
    final level = data
        .threshold('monthly_rain', month)
        .classify(selectedMonth.rain);
    return Center(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 800),
        child: ListView(
          key: const PageStorageKey('water-dashboard-scroll'),
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
          children: [
            const Text('Mogi das Cruzes/SP', style: AgroDesign.section),
            const SizedBox(height: 4),
            Text(
              'Dados históricos até ${waterDate(data.dataAsOf)} · NASA POWER',
              style: AgroDesign.caption,
            ),
            const SizedBox(height: 6),
            const Text(
              'Somente Mogi das Cruzes/SP, mesmo se sua propriedade estiver em outro município.',
              style: AgroDesign.caption,
            ),
            const SizedBox(height: 16),
            LayoutBuilder(
              builder: (context, box) {
                final stack =
                    box.maxWidth < 330 ||
                    MediaQuery.textScalerOf(context).scale(14) > 21;
                final width = stack ? box.maxWidth : (box.maxWidth - 12) / 2;
                return Wrap(
                  spacing: 12,
                  runSpacing: 12,
                  children: [
                    SizedBox(
                      width: width,
                      child: TerritorialYearFilter(
                        year: year,
                        years: data.years,
                        onChanged: selectYear,
                      ),
                    ),
                    SizedBox(
                      width: width,
                      child: DropdownButtonFormField<int>(
                        key: ValueKey('month-$year-$month'),
                        initialValue: month,
                        isExpanded: true,
                        decoration: const InputDecoration(
                          labelText: 'Mês encerrado',
                        ),
                        items: yearMonths
                            .map(
                              (m) => DropdownMenuItem(
                                value: m.date.month,
                                child: Text(waterMonths[m.date.month - 1]),
                              ),
                            )
                            .toList(),
                        onChanged: (value) {
                          if (value != null) selectMonth(value);
                        },
                      ),
                    ),
                  ],
                );
              },
            ),
            const SizedBox(height: 16),
            DashboardCard(
              dark: true,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: Text(
                          'CHUVA NO MÊS',
                          style: AgroDesign.eyebrow.copyWith(
                            color: dashboardLime,
                          ),
                        ),
                      ),
                      const Icon(
                        Icons.water_drop_outlined,
                        color: dashboardLime,
                        size: 26,
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Text(
                    selectedMonth.label,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 17,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 10),
                  Wrap(
                    spacing: 8,
                    crossAxisAlignment: WrapCrossAlignment.center,
                    children: [
                      Text(
                        waterNumber(selectedMonth.rain),
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 42,
                          fontWeight: FontWeight.w700,
                          height: 1.1,
                        ),
                      ),
                      if (selectedMonth.rain != null)
                        const Text(
                          'mm',
                          style: TextStyle(color: Colors.white, fontSize: 18),
                        ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  Text(
                    anomaly == null
                        ? 'Comparação indisponível'
                        : anomaly == 0
                        ? 'Choveu o mesmo que a média histórica'
                        : anomaly.abs() < 1
                        ? 'Chuva próxima à média histórica (diferença menor que 1%)'
                        : 'Choveu ${waterNumber(anomaly.abs(), decimals: 0)}% ${anomaly < 0 ? 'menos' : 'mais'} que a média histórica',
                    style: const TextStyle(
                      color: dashboardLime,
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 7),
                  Text(
                    'Média deste mês: ${waterNumber(reference.mean)} mm (2000–2019)',
                    style: const TextStyle(
                      color: Color(0xFFE1ECD7),
                      fontSize: 13,
                      height: 1.4,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),
            DashboardCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const DashboardHeading(
                    title: 'O ritmo das chuvas',
                    description: 'Chuva de cada mês e o que costuma chover.',
                    icon: Icons.bar_chart_rounded,
                  ),
                  const SizedBox(height: 18),
                  Wrap(
                    spacing: 16,
                    runSpacing: 8,
                    children: [
                      ChartLegend(
                        label: 'Chuva em $year',
                        color: AgroDesign.green,
                      ),
                      const ChartLegend(
                        label: 'Média histórica',
                        color: dashboardLime,
                      ),
                    ],
                  ),
                  const SizedBox(height: 18),
                  DashboardBarChart(
                    key: ValueKey('seasonal-$year'),
                    points: [
                      for (final m in yearMonths)
                        DashboardChartPoint(
                          label: waterMonths[m.date.month - 1].substring(0, 3),
                          semanticLabel:
                              '${m.label}: ${waterNumber(m.rain)} mm. Média histórica: '
                              '${waterNumber(data.reference(m.date.month).mean)} mm. Selecionar mês.',
                          value: m.rain,
                          reference: data.reference(m.date.month).mean,
                        ),
                    ],
                    selected: yearMonths.indexOf(selectedMonth),
                    onSelected: (index) =>
                        selectMonth(yearMonths[index].date.month),
                    unit: 'mm',
                    comparison: true,
                  ),
                  const SizedBox(height: 16),
                  Semantics(
                    liveRegion: true,
                    child: Text(
                      '${selectedMonth.label}: ${waterNumber(selectedMonth.rain)} mm. '
                      'Média histórica: ${waterNumber(reference.mean)} mm.',
                      style: AgroDesign.body,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),
            DashboardCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '${waterNumber(selectedMonth.dryDays, decimals: 0)} dias com pouca chuva',
                    style: AgroDesign.section,
                  ),
                  const SizedBox(height: 6),
                  Text(
                    '${selectedMonth.label} · menos de 1 mm por dia. Isso não significa, por si só, seca agrícola.',
                    style: AgroDesign.caption,
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            Material(
              color: Colors.white,
              borderRadius: BorderRadius.circular(24),
              child: ExpansionTile(
                key: const PageStorageKey('water-detailed-analysis'),
                maintainState: true,
                title: const Text(
                  'Ver análise detalhada',
                  style: AgroDesign.section,
                ),
                subtitle: const Text(
                  'Acumulados, sequências e origem dos dados',
                  style: AgroDesign.caption,
                ),
                childrenPadding: const EdgeInsets.all(12),
                children: [
                  _dataTable(yearMonths),
                  const SizedBox(height: 16),
                  const DashboardHeading(
                    title: 'Acumulados e períodos secos',
                    description: 'Explore uma data do passado. Baixa chuva: menos de 1 mm por dia.',
                    icon: Icons.water_outlined,
                  ),
                  const SizedBox(height: 16),
                  DashboardCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Wrap(
                          spacing: 8,
                          runSpacing: 8,
                          children: [
                            for (var i = 0; i < 3; i++)
                              ChoiceChip(
                                label: Text(
                                  ['7 dias', '30 dias', 'Baixa chuva'][i],
                                ),
                                selected: series == i,
                                showCheckmark: true,
                                selectedColor: dashboardLime,
                                labelStyle: const TextStyle(
                                  color: AgroDesign.ink,
                                ),
                                materialTapTargetSize:
                                    MaterialTapTargetSize.padded,
                                onSelected: (_) => setState(() => series = i),
                              ),
                          ],
                        ),
                        const SizedBox(height: 16),
                        Text(seriesTitle, style: AgroDesign.section),
                        const SizedBox(height: 12),
                        if (daily.isEmpty)
                          const Text(
                            'Sem dados diários neste período.',
                            style: AgroDesign.body,
                          )
                        else
                          DashboardBarChart(
                            key: ValueKey('daily-$year-$month-$series'),
                            points: [
                              for (final d in daily)
                                DashboardChartPoint(
                                  label: '${d.date.day}',
                                  value: seriesValue(d),
                                  semanticLabel:
                                      '${waterDate(d.date)}: $seriesTitle, '
                                      '${waterNumber(seriesValue(d), decimals: series == 2 ? 0 : 2)} $unit. Selecionar data.',
                                ),
                            ],
                            selected: daily.indexWhere(
                              (d) => d.date.day == day,
                            ),
                            onSelected: (index) =>
                                setState(() => day = daily[index].date.day),
                            unit: unit,
                          ),
                        const SizedBox(height: 14),
                        Semantics(
                          liveRegion: true,
                          child: Text(
                            '${waterDate(selectedDate)} (LST): '
                            '${waterNumber(dayReading == null ? null : seriesValue(dayReading), decimals: series == 2 ? 0 : 2)}'
                            '${dayReading == null || seriesValue(dayReading) == null ? '' : ' $unit'}.',
                            style: AgroDesign.section,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          waterLevel(
                            dayReading == null
                                ? 'indisponivel'
                                : switch (series) {
                                    0 => dayReading.level7,
                                    1 => dayReading.level30,
                                    _ => dayReading.dryLevel,
                                  },
                          ),
                          style: AgroDesign.body,
                        ),
                        const SizedBox(height: 10),
                        const Text(
                          'Faixas estatísticas do mês de término, calculadas em 2000–2019. '
                          'Janelas incluem o dia selecionado e podem atravessar meses. Não são alertas de risco.',
                          style: AgroDesign.caption,
                        ),
                        ExpansionTile(
                          key: PageStorageKey(
                            'thresholds-$year-$month-$series',
                          ),
                          tilePadding: EdgeInsets.zero,
                          title: const Text(
                            'Como ler esta faixa',
                            style: AgroDesign.body,
                          ),
                          children: [
                            Padding(
                              padding: const EdgeInsets.only(bottom: 12),
                              child: Text(
                                _thresholdExplanation(),
                                style: AgroDesign.caption,
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                  Semantics(
                    header: true,
                    child: Text(
                      'Leitura em ${waterDate(selectedDate)} · LST',
                      style: AgroDesign.section,
                    ),
                  ),
                  const SizedBox(height: 12),
                  IndicatorGrid(
                    children: [
                      IndicatorCard(
                        title: 'Chuva em 7 dias',
                        value: waterNumber(dayReading?.rain7),
                        unit: 'mm',
                        icon: Icons.water_drop_outlined,
                        contextLabel:
                            '${waterDate(selectedDate.subtract(const Duration(days: 6)))} a '
                            '${waterDate(selectedDate)}\n${waterLevel(dayReading?.level7 ?? 'indisponivel')}',
                      ),
                      IndicatorCard(
                        title: 'Chuva em 30 dias',
                        value: waterNumber(dayReading?.rain30),
                        unit: 'mm',
                        icon: Icons.calendar_view_month_outlined,
                        contextLabel:
                            '${waterDate(selectedDate.subtract(const Duration(days: 29)))} a '
                            '${waterDate(selectedDate)}\n${waterLevel(dayReading?.level30 ?? 'indisponivel')}',
                      ),
                      IndicatorCard(
                        title: 'Sequência de baixa chuva',
                        value: waterNumber(dayReading?.dryRun, decimals: 0),
                        unit: 'dias',
                        icon: Icons.wb_sunny_outlined,
                        contextLabel:
                            'Sequência terminando em ${waterDate(selectedDate)}. '
                            'Zero significa que este dia teve ao menos 1 mm.',
                      ),
                      IndicatorCard(
                        title: 'Dias de baixa chuva no mês',
                        value: waterNumber(selectedMonth.dryDays, decimals: 0),
                        unit: 'dias',
                        icon: Icons.date_range_outlined,
                        contextLabel:
                            '${selectedMonth.label}. Maior sequência dentro do mês: '
                            '${waterNumber(selectedMonth.maxDryRun, decimals: 0)} dias. Não indica seca agrícola.',
                      ),
                    ],
                  ),
                  const SizedBox(height: 24),
                  DashboardCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const DashboardHeading(
                          title: 'O que mudou neste mês?',
                          description: 'Anomalia é a diferença em relação à média histórica do mesmo mês.',
                          icon: Icons.compare_arrows_rounded,
                        ),
                        const SizedBox(height: 16),
                        Text(
                          '${waterNumber(selectedMonth.anomalyMm)} mm',
                          style: AgroDesign.title,
                        ),
                        const SizedBox(height: 10),
                        Text(
                          anomaly == null
                              ? 'Sem dados suficientes para comparar.'
                              : '${selectedMonth.label} teve ${waterNumber(anomaly.abs())}% '
                                    '${anomaly < 0
                                        ? 'menos'
                                        : anomaly > 0
                                        ? 'mais'
                                        : 'de diferença na'} chuva '
                                    'que a média do mesmo mês em 2000–2019.',
                          style: AgroDesign.body,
                        ),
                        const SizedBox(height: 10),
                        Text(
                          waterLevel(level),
                          style: AgroDesign.body.copyWith(
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        const SizedBox(height: 10),
                        const Text(
                          'Isso descreve chuva regional passada. Não informa água no solo, '
                          'disponibilidade de água, risco agrícola ou necessidade de irrigação.',
                          style: AgroDesign.caption,
                        ),
                        ExpansionTile(
                          key: PageStorageKey('anomaly-$year-$month'),
                          tilePadding: EdgeInsets.zero,
                          title: const Text(
                            'Detalhes da comparação',
                            style: AgroDesign.body,
                          ),
                          children: [
                            Padding(
                              padding: const EdgeInsets.only(bottom: 12),
                              child: Text(
                                'Diferença = total mensal − média do mesmo mês. '
                                'Diferença percentual = 100 × (total ÷ média − 1). '
                                'Desvio padronizado z: ${waterNumber(selectedMonth.anomalyZ, decimals: 3)} '
                                '(adimensional, desvio amostral). Não é SPI, SPEI ou probabilidade. '
                                'A faixa vem dos quantis do total mensal, nunca de z. '
                                'As 20 amostras de cada mês tornam as caudas incertas.',
                                style: AgroDesign.caption,
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 24),
                  _provenance(),
                  const SizedBox(height: 20),
                  const DashboardCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Próximos painéis', style: AgroDesign.section),
                        SizedBox(height: 8),
                        Text(
                          'Produção e excedentes · disponível na aba Produção\nLogística · não implementado',
                          style: AgroDesign.body,
                        ),
                        SizedBox(height: 8),
                        Text(
                          'Este painel mostra o histórico regional de chuvas. '
                          'As telas de produção e pedidos do app continuam disponíveis ao voltar.',
                          style: AgroDesign.caption,
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _dataTable(List<WaterMonth> months) => ExpansionTile(
    key: PageStorageKey('table-$year'),
    tilePadding: EdgeInsets.zero,
    title: const Text('Ver valores por mês', style: AgroDesign.body),
    children: [
      for (final m in months)
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 8),
          child: Text(
            '${m.label}: ${waterNumber(m.rain)} mm. '
            'Referência: ${waterNumber(data.reference(m.date.month).mean)} mm.',
            style: AgroDesign.body,
          ),
        ),
    ],
  );

  String _thresholdExplanation() {
    final t = data.threshold(['rain_7d', 'rain_30d', 'low_run'][series], month);
    return 'Referência de ${waterMonths[month - 1].toLowerCase()} (2000–2019). '
        'Quantis dividem a distribuição histórica; não são probabilidades individuais. '
        'Limites em ${series == 2 ? 'dias' : 'mm'}: q10 ${waterNumber(t.q10, decimals: 4)}; '
        'q25 ${waterNumber(t.q25, decimals: 4)}; q75 ${waterNumber(t.q75, decimals: 4)}; '
        'q90 ${waterNumber(t.q90, decimals: 4)}. Classificação usa limites sem arredondar. '
        '${series == 2 ? 'A distribuição inclui dias com duração zero. Não é amostra de eventos independentes.' : 'Faixa central inclui q25 e q75. Abaixo de q10 usa desigualdade estrita; zero não é ausente.'}';
  }

  Widget _provenance() {
    final source = data.sourceIndicator;
    final quality = source['quality'] as WaterJson;
    String utcDate(String value) {
      final d = DateTime.parse(value).toUtc();
      return '${waterDate(d)} às ${d.hour.toString().padLeft(2, '0')}:'
          '${d.minute.toString().padLeft(2, '0')} UTC';
    }

    return DashboardCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const DashboardHeading(
            title: 'Fonte e limites de uso',
            description: 'Dados regionais para conhecer o passado, sem recomendação automática.',
            icon: Icons.info_outline_rounded,
          ),
          const SizedBox(height: 12),
          const Text(
            'NASA POWER AG · ponto de referência da sede municipal '
            '(−23,52°, −46,19°). Produto em grade, sem medição na propriedade. '
            'LST é a hora solar local da fonte; difere do horário civil e de UTC.',
            style: AgroDesign.body,
          ),
          const SizedBox(height: 10),
          Text(
            'Base diária: ${waterNumber(data.days.length, decimals: 0)} registros. '
            'Completude: ${waterNumber(quality['dataset_completeness_pct'] as num?, decimals: 0)}%. '
            '${quality['imputation'] == false ? 'Sem imputação.' : 'Consulte o registro de imputação.'} '
            'Completude não é acurácia de campo. Validação externa não realizada.',
            style: AgroDesign.caption,
          ),
          ExpansionTile(
            key: const PageStorageKey('water-provenance'),
            tilePadding: EdgeInsets.zero,
            title: const Text(
              'Proveniência do pacote local',
              style: AgroDesign.body,
            ),
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Observado até: ${waterDate(data.dataAsOf)} (LST).\n'
                    'Extraído da fonte: ${utcDate(source['source_updated_at_utc'] as String)}.\n'
                    'Consolidado: ${utcDate(data.contract['generated_at_utc'] as String)}.\n'
                    'Contrato: ${data.contract['schema_version']}.\n'
                    'Pacote: ${data.provenance['package_version']}.\n'
                    'Entrega: arquivos versionados incluídos no app, sem endpoint. '
                    'Reabrir ou tentar novamente relê o pacote; não busca novos dados.',
                    style: AgroDesign.caption,
                  ),
                  const SizedBox(height: 10),
                  const Text(
                    'Origem no repositório: analytics/agro-agua/outputs/agua04. '
                    'Inclui contrato, séries mensais/diárias, referência, limiares, auditoria e inventário.',
                    style: AgroDesign.caption,
                  ),
                  const SizedBox(height: 10),
                  SelectableText(
                    'SHA-256 da base diária:\n${source['source']['daily_sha256']}',
                    style: AgroDesign.caption,
                  ),
                  const SizedBox(height: 12),
                ],
              ),
            ],
          ),
          ExpansionTile(
            key: const PageStorageKey('water-limitations'),
            tilePadding: EdgeInsets.zero,
            title: const Text('Entenda as limitações', style: AgroDesign.body),
            children: [
              for (final limitation in (source['limitations'] as List))
                Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: Text(limitation as String, style: AgroDesign.body),
                ),
              const Padding(
                padding: EdgeInsets.only(bottom: 12),
                child: Text(
                  'Não há informação de solo, vazão, reservatório ou evapotranspiração. '
                  'Não há previsão operacional, inferência Ridge ou alerta atual neste painel. '
                  'Valores ausentes são apresentados como indisponíveis.',
                  style: AgroDesign.body,
                ),
              ),
            ],
          ),
          TextButton.icon(
            onPressed: () async {
              final url = Uri.parse(source['source']['url'] as String);
              var opened = false;
              try {
                opened = await launchUrl(
                  url,
                  mode: LaunchMode.externalApplication,
                );
              } on Object {
                opened = false;
              }
              if (!opened && mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(content: Text('Documentação da fonte: $url')),
                );
              }
            },
            icon: const Icon(Icons.open_in_new, size: 18),
            label: const Text('Documentação NASA POWER'),
          ),
        ],
      ),
    );
  }
}
