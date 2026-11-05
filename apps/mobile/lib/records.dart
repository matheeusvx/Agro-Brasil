import 'package:flutter/material.dart';

import 'data.dart';
import 'design.dart';
import 'illustrations.dart';
import 'home.dart';

class CropRecord extends StatelessWidget {
  final Json item;
  final VoidCallback onTap;
  const CropRecord({super.key, required this.item, required this.onTap});
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 14),
    child: Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(22),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    decoration: BoxDecoration(
                      color: AgroDesign.wash,
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: const FarmIllustration(
                      art: FarmArt.harvest,
                      width: 72,
                      height: 66,
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          item['cropName'] ?? 'Produção',
                          style: AgroDesign.section,
                        ),
                        const SizedBox(height: 4),
                        Text(
                          '${item['quantityKg']} kg',
                          style: AgroDesign.title,
                        ),
                      ],
                    ),
                  ),
                  const Icon(Icons.chevron_right, color: AgroDesign.green),
                ],
              ),
              const SizedBox(height: 16),
              Text('Safra ${item['seasonLabel']}', style: AgroDesign.caption),
              const SizedBox(height: 10),
              const Divider(height: 1, color: AgroDesign.line),
              const SizedBox(height: 12),
              const Row(
                children: [
                  Icon(Icons.route_outlined, size: 18, color: AgroDesign.green),
                  SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'Consultar origem e histórico',
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                        color: AgroDesign.green,
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    ),
  );
}

class FormSection extends StatelessWidget {
  final String number;
  final String title;
  const FormSection({super.key, required this.number, required this.title});
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 16),
    child: Row(
      children: [
        Container(
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(
            color: AgroDesign.wash,
            borderRadius: BorderRadius.circular(12),
          ),
          child: Text(
            number,
            style: AgroDesign.eyebrow.copyWith(color: AgroDesign.forest),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(child: Text(title, style: AgroDesign.section)),
      ],
    ),
  );
}

class EventTimeline extends StatelessWidget {
  final List<Json> events;
  const EventTimeline({super.key, required this.events});
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(top: 24),
    child: Column(
      children: [
        for (var i = 0; i < events.length; i++)
          IntrinsicHeight(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                SizedBox(
                  width: 20,
                  child: ExcludeSemantics(
                    child: Stack(
                      alignment: Alignment.topCenter,
                      children: [
                        if (events.length > 1)
                          Positioned(
                            top: i == 0 ? 28 : 0,
                            bottom: i == events.length - 1 ? null : 0,
                            height: i == events.length - 1 ? 28 : null,
                            child: Container(width: 1, color: AgroDesign.line),
                          ),
                        Positioned(
                          top: 18,
                          child: Container(
                            width: 20,
                            height: 20,
                            decoration: const BoxDecoration(
                              color: AgroDesign.forest,
                              shape: BoxShape.circle,
                            ),
                            child: const Icon(
                              Icons.check,
                              size: 12,
                              color: Colors.white,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Container(
                    margin: const EdgeInsets.only(bottom: 20),
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(18),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          eventLabel(events[i]['type']),
                          style: AgroDesign.section,
                        ),
                        const SizedBox(height: 8),
                        Text(
                          dateLabel(events[i]['recordedAt']),
                          style: AgroDesign.caption,
                        ),
                        const SizedBox(height: 8),
                        Text(
                          '${events[i]['location']?['municipality'] ?? 'Local não informado'}${events[i]['location']?['uf'] == null ? '' : ' · ${events[i]['location']['uf']}'}',
                          style: AgroDesign.body,
                        ),
                        if (events[i]['responsibleOrganizationId'] != null) ...[
                          const SizedBox(height: 8),
                          SelectableText(
                            'Organização responsável: ${events[i]['responsibleOrganizationId']}',
                            style: AgroDesign.caption,
                          ),
                        ],
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
      ],
    ),
  );
}
