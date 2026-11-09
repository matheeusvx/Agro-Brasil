import 'dart:convert';

import 'package:flutter/services.dart';
import 'package:intl/intl.dart';

typedef WaterJson = Map<String, dynamic>;

String waterNumber(num? value, {int decimals = 2}) => value == null
    ? 'Indisponível'
    : NumberFormat.decimalPatternDigits(
        locale: 'pt_BR',
        decimalDigits: decimals,
      ).format(value);

// LST is a calendar in the source product. Do not convert to local/UTC time.
String waterDate(DateTime date) =>
    DateFormat('dd/MM/yyyy', 'pt_BR').format(date);

const waterMonths = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

DateTime _calendarDate(String input) {
  final parsed = DateTime.parse(input);
  // UTC here is only a DST-free calendar container; the displayed data remain LST.
  return DateTime.utc(parsed.year, parsed.month, parsed.day);
}

int _dayKey(DateTime date) => date.year * 10000 + date.month * 100 + date.day;

double? _number(String? input) {
  if (input == null || input.isEmpty) return null;
  final value = double.tryParse(input);
  if (value == null || !value.isFinite) {
    throw const FormatException('Valor numérico inválido no pacote hídrico.');
  }
  return value;
}

/// These audited CSVs contain only unquoted numeric, ISO-date and enum fields.
List<Map<String, String>> _csv(String input) {
  final lines = const LineSplitter()
      .convert(input)
      .where((s) => s.isNotEmpty)
      .toList();
  if (lines.isEmpty) throw const FormatException('Arquivo sem cabeçalho.');
  final headers = lines.first.split(',');
  return lines.skip(1).map((line) {
    final cells = line.split(',');
    if (cells.length != headers.length || line.contains('"')) {
      throw const FormatException('Estrutura CSV incompatível.');
    }
    return Map.fromIterables(headers, cells);
  }).toList();
}

class WaterMonth {
  final DateTime date;
  final double? rain, dryDays, maxDryRun, anomalyMm, anomalyPercent, anomalyZ;
  WaterMonth(Map<String, String> row)
    : date = _calendarDate(row['date']!),
      rain = _number(row['rain_total_mm']),
      dryDays = _number(row['low_days_lt1']),
      maxDryRun = _number(row['max_low_run_lt1_within_period']),
      anomalyMm = _number(row['rain_anomaly_mm']),
      anomalyPercent = _number(row['rain_anomaly_percent']),
      anomalyZ = _number(row['rain_anomaly_z']);
  DateTime get end => DateTime.utc(date.year, date.month + 1, 0);
  String get label => '${waterMonths[date.month - 1]} de ${date.year}';
}

class WaterDay {
  final DateTime date;
  final double? rain7, rain30, dryRun;
  final String level7, level30, dryLevel;
  WaterDay(Map<String, String> row)
    : date = _calendarDate(row['date']!),
      rain7 = _number(row['rain_7d_mm']),
      rain30 = _number(row['rain_30d_mm']),
      dryRun = _number(row['low_run_days']),
      level7 = row['rain_7d_level']!,
      level30 = row['rain_30d_level']!,
      dryLevel = row['low_run_level']!;
}

class WaterReference {
  final int month, sampleYears;
  final double? mean;
  WaterReference(Map<String, String> row)
    : month = int.parse(row['calendar_month']!),
      sampleYears = int.parse(row['rain_n_years']!),
      mean = _number(row['rain_mean_mm']);
}

class WaterThreshold {
  final String indicator;
  final int month;
  final double q10, q25, q75, q90;
  WaterThreshold(Map<String, String> row)
    : indicator = row['indicator']!,
      month = int.parse(row['calendar_month']!),
      q10 = _number(row['q10'])!,
      q25 = _number(row['q25'])!,
      q75 = _number(row['q75'])!,
      q90 = _number(row['q90'])!;

  String classify(double? value) {
    if (value == null || !value.isFinite) return 'indisponivel';
    if (indicator == 'low_run') {
      if (value == 0) return 'sem_sequencia';
      if (value <= q75) return 'duracao_ate_q75';
      if (value <= q90) return 'duracao_acima_q75';
      return 'duracao_acima_q90';
    }
    if (value < q10) return 'abaixo_q10';
    if (value < q25) return 'entre_q10_q25';
    if (value <= q75) return 'entre_q25_q75';
    if (value <= q90) return 'entre_q75_q90';
    return 'acima_q90';
  }
}

String waterLevel(String level) => switch (level) {
  'abaixo_q10' => 'Abaixo do quantil 10 da referência',
  'entre_q10_q25' => 'Entre os quantis 10 e 25 da referência',
  'entre_q25_q75' => 'Na faixa central da referência',
  'entre_q75_q90' => 'Entre os quantis 75 e 90 da referência',
  'acima_q90' => 'Acima do quantil 90 da referência',
  'sem_sequencia' => 'Sem sequência de baixa chuva nesta data',
  'duracao_ate_q75' => 'Duração até o quantil 75 da referência',
  'duracao_acima_q75' => 'Duração entre os quantis 75 e 90',
  'duracao_acima_q90' => 'Duração acima do quantil 90',
  _ => 'Dados insuficientes para esta janela',
};

class WaterSnapshot {
  final WaterJson contract, provenance;
  final List<WaterMonth> months;
  final List<WaterDay> days;
  final List<WaterReference> references;
  final List<WaterThreshold> thresholds;
  late final Map<int, WaterDay> _dayIndex = {
    for (final day in days) _dayKey(day.date): day,
  };

  WaterSnapshot.parse({
    required String integration,
    required String monthly,
    required String daily,
    required String seasonal,
    required String threshold,
    required String manifest,
  }) : contract = jsonDecode(integration) as WaterJson,
       provenance = jsonDecode(manifest) as WaterJson,
       months = _csv(monthly).map(WaterMonth.new).toList(),
       days = _csv(daily).map(WaterDay.new).toList(),
       references = _csv(seasonal).map(WaterReference.new).toList(),
       thresholds = _csv(threshold).map(WaterThreshold.new).toList() {
    if (contract['schema_version'] != 'agua04-1.0' ||
        provenance['schema_version'] != contract['schema_version'] ||
        contract['purpose'] !=
            'snapshot_academico_retrospectivo_sem_endpoint' ||
        contract['data_as_of'] != provenance['data_as_of']) {
      throw const FormatException('Versão do pacote hídrico incompatível.');
    }
    final indicators = (contract['indicators'] as List).cast<WaterJson>();
    if (indicators.isEmpty ||
        indicators.any(
          (item) =>
              item['municipality']['ibge_code'] != '3530607' ||
              item['source']['name'] != 'NASA POWER' ||
              item['decision_authorized'] != false ||
              item['operational_availability'] != 'retrospectivo_sem_servico' ||
              item['observed_period']['time_standard'] != 'LST',
        )) {
      throw const FormatException('Proveniência ou finalidade incompatível.');
    }
    if (references.length != 12 ||
        references.map((r) => r.month).toSet().length != 12 ||
        references.any(
          (r) => r.month < 1 || r.month > 12 || r.sampleYears != 20,
        ) ||
        months.map((m) => m.date).toSet().length != months.length ||
        days.map((d) => d.date).toSet().length != days.length ||
        days.any((d) => d.date.isAfter(dataAsOf)) ||
        months.any((m) => m.end.isAfter(dataAsOf))) {
      throw const FormatException('Períodos ou amostras incompatíveis.');
    }
    months.sort((a, b) => a.date.compareTo(b.date));
    days.sort((a, b) => a.date.compareTo(b.date));
  }

  DateTime get dataAsOf => _calendarDate(contract['data_as_of'] as String);
  List<int> get years =>
      months.map((m) => m.date.year).toSet().toList()..sort();
  WaterJson get sourceIndicator =>
      (contract['indicators'] as List).first as WaterJson;
  WaterDay? dayAt(DateTime date) => _dayIndex[_dayKey(date)];
  WaterReference reference(int month) =>
      references.firstWhere((r) => r.month == month);
  WaterThreshold threshold(String indicator, int month) => thresholds
      .firstWhere((t) => t.indicator == indicator && t.month == month);
}

class WaterRepository {
  final AssetBundle? bundle;
  const WaterRepository({this.bundle});

  Future<WaterSnapshot> load() async {
    final assets = bundle ?? rootBundle;
    final files = await Future.wait([
      for (final name in [
        'integration-example.json',
        'monthly_indicators.csv',
        'historical_indicators.csv',
        'training_monthly_reference.csv',
        'thresholds.csv',
        'provenance.json',
      ])
        assets.loadString('assets/agua04/$name'),
    ]);
    return WaterSnapshot.parse(
      integration: files[0],
      monthly: files[1],
      daily: files[2],
      seasonal: files[3],
      threshold: files[4],
      manifest: files[5],
    );
  }
}
