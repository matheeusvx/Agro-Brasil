import 'package:flutter/material.dart';

import 'data.dart';
import 'design.dart';
import 'home.dart';
import 'motion.dart';

/// Personalização do perfil. A API ainda não tem edição de perfil, então
/// estes dados ficam neste aparelho, por usuário e organização, e nunca são
/// enviados ao servidor nem substituem dados oficiais (organização, vínculo).
class ProfilePrefs {
  final String displayName;
  final String about;
  final List<String> crops;
  final int avatarTone;
  final bool largerText;
  final bool reduceMotion;
  const ProfilePrefs({
    this.displayName = '',
    this.about = '',
    this.crops = const [],
    this.avatarTone = 0,
    this.largerText = false,
    this.reduceMotion = false,
  });

  factory ProfilePrefs.fromJson(Json? json) => json == null
      ? const ProfilePrefs()
      : ProfilePrefs(
          displayName: (json['displayName'] as String? ?? '').trim(),
          about: (json['about'] as String? ?? '').trim(),
          crops: [
            for (final c in (json['crops'] as List? ?? const []))
              if (c is String) c,
          ],
          avatarTone: ((json['avatarTone'] as num?)?.toInt() ?? 0).clamp(
            0,
            avatarTones.length - 1,
          ),
          largerText: json['largerText'] == true,
          reduceMotion: json['reduceMotion'] == true,
        );

  Json toJson() => {
    'displayName': displayName,
    'about': about,
    'crops': crops,
    'avatarTone': avatarTone,
    'largerText': largerText,
    'reduceMotion': reduceMotion,
  };

  ProfilePrefs copyWith({
    String? displayName,
    String? about,
    List<String>? crops,
    int? avatarTone,
    bool? largerText,
    bool? reduceMotion,
  }) => ProfilePrefs(
    displayName: displayName ?? this.displayName,
    about: about ?? this.about,
    crops: crops ?? this.crops,
    avatarTone: avatarTone ?? this.avatarTone,
    largerText: largerText ?? this.largerText,
    reduceMotion: reduceMotion ?? this.reduceMotion,
  );
}

/// Tons da paleta para o avatar (todos com texto branco legível).
const avatarTones = [
  AgroDesign.forest,
  AgroDesign.green,
  Color(0xFF2F6F73),
  AgroDesign.earth,
  Color(0xFF5B6B2E),
];

/// Preferências ativas; o app inteiro reage (texto maior, menos animação).
final appPrefs = ValueNotifier<ProfilePrefs>(const ProfilePrefs());

String _key(HomeController c) => '${c.repository.scope}/profile';

Future<void> loadProfilePrefs(HomeController c) async {
  try {
    appPrefs.value = ProfilePrefs.fromJson(await c.store.get(_key(c)));
  } on Object {
    appPrefs.value = const ProfilePrefs();
  }
}

Future<void> saveProfilePrefs(HomeController c, ProfilePrefs prefs) async {
  appPrefs.value = prefs;
  try {
    await c.store.put(_key(c), prefs.toJson());
  } on Object {
    /* Sem armazenamento local: a preferência vale até fechar o app. */
  }
}

/// Aplica as preferências de acessibilidade escolhidas no perfil.
Widget applyProfilePrefs(BuildContext context, Widget? child) =>
    ValueListenableBuilder<ProfilePrefs>(
      valueListenable: appPrefs,
      child: child,
      builder: (context, prefs, child) {
        final media = MediaQuery.of(context);
        return MediaQuery(
          data: media.copyWith(
            textScaler: prefs.largerText
                ? TextScaler.linear(media.textScaler.scale(1) * 1.15)
                : media.textScaler,
            disableAnimations: media.disableAnimations || prefs.reduceMotion,
          ),
          child: child ?? const SizedBox.shrink(),
        );
      },
    );

String profileInitials(String name) {
  final words = name
      .split(RegExp(r'[\s·\-]+'))
      .where((w) => w.isNotEmpty && RegExp(r'[A-Za-zÀ-ÿ]').hasMatch(w[0]))
      .toList();
  if (words.isEmpty) return 'A+';
  return words.take(2).map((w) => w[0].toUpperCase()).join();
}

class ProfileAvatar extends StatelessWidget {
  final String name;
  final int tone;
  final double size;
  const ProfileAvatar({
    super.key,
    required this.name,
    required this.tone,
    this.size = 64,
  });
  @override
  Widget build(BuildContext context) => ExcludeSemantics(
    child: AnimatedContainer(
      duration: AgroMotion.of(context, const Duration(milliseconds: 220)),
      curve: AgroMotion.respond,
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: avatarTones[tone.clamp(0, avatarTones.length - 1)],
        shape: BoxShape.circle,
        boxShadow: AgroDesign.softShadow,
      ),
      child: AnimatedSwitcher(
        duration: AgroMotion.of(context, AgroMotion.stateDuration),
        child: Text(
          profileInitials(name),
          key: ValueKey(profileInitials(name)),
          style: TextStyle(
            fontSize: size * .34,
            fontWeight: FontWeight.w700,
            color: Colors.white,
          ),
        ),
      ),
    ),
  );
}

class ProfilePage extends StatelessWidget {
  final HomeController controller;
  final VoidCallback? onLogout;
  const ProfilePage({super.key, required this.controller, this.onLogout});

  @override
  Widget build(BuildContext context) => ValueListenableBuilder<ProfilePrefs>(
    valueListenable: appPrefs,
    builder: (context, prefs, _) {
      final org = controller.repository.organizationName;
      final name = prefs.displayName.isNotEmpty
          ? prefs.displayName
          : (controller.home?['userName'] as String? ?? '').trim().isNotEmpty
          ? (controller.home!['userName'] as String).trim()
          : org;
      final canWrite = controller.home?['canWrite'] == true;
      return Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 760),
          child: ListView(
            padding: const EdgeInsets.all(20),
            children: [
              const Reveal(
                child: ModuleHeading(
                  title: 'Meu perfil',
                  subtitle: 'Seu vínculo com o campo.',
                ),
              ),
              Reveal(
                index: 1,
                child: AgroSurface(
                  padding: const EdgeInsets.all(20),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Row(
                        children: [
                          ProfileAvatar(name: name, tone: prefs.avatarTone),
                          const SizedBox(width: 16),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(name, style: AgroDesign.title),
                                const SizedBox(height: 2),
                                if (name != org)
                                  Text(org, style: AgroDesign.caption),
                                const SizedBox(height: 8),
                                const StatusPill('Pequeno produtor rural'),
                              ],
                            ),
                          ),
                        ],
                      ),
                      if (prefs.about.isNotEmpty) ...[
                        const SizedBox(height: 16),
                        Text(prefs.about, style: AgroDesign.body),
                      ],
                      if (prefs.crops.isNotEmpty) ...[
                        const SizedBox(height: 14),
                        Wrap(
                          spacing: 8,
                          runSpacing: 8,
                          children: [
                            for (final crop in prefs.crops)
                              Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 12,
                                  vertical: 6,
                                ),
                                decoration: BoxDecoration(
                                  color: AgroDesign.mint,
                                  borderRadius: BorderRadius.circular(999),
                                ),
                                child: Text(
                                  crop,
                                  style: AgroDesign.caption.copyWith(
                                    color: AgroDesign.forest,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                              ),
                          ],
                        ),
                      ],
                      const SizedBox(height: 18),
                      PressScale(
                        child: OutlinedButton.icon(
                          onPressed: () => Navigator.push(
                            context,
                            PageRouteBuilder<void>(
                              transitionDuration: AgroMotion.of(
                                context,
                                AgroMotion.respondDuration,
                              ),
                              reverseTransitionDuration: AgroMotion.of(
                                context,
                                const Duration(milliseconds: 220),
                              ),
                              pageBuilder: (_, _, _) =>
                                  EditProfilePage(controller: controller),
                              transitionsBuilder: (_, animation, _, child) {
                                final curved = CurvedAnimation(
                                  parent: animation,
                                  curve: AgroMotion.respond,
                                );
                                return FadeTransition(
                                  opacity: curved,
                                  child: SlideTransition(
                                    position: Tween(
                                      begin: const Offset(0, .04),
                                      end: Offset.zero,
                                    ).animate(curved),
                                    child: child,
                                  ),
                                );
                              },
                            ),
                          ),
                          icon: const Icon(Icons.edit_outlined, size: 18),
                          label: const Text('Editar perfil'),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: AgroDesign.sectionGap),
              const Reveal(
                index: 2,
                child: SectionHeading(title: 'Sua propriedade'),
              ),
              const SizedBox(height: 12),
              Reveal(index: 3, child: PropertyHeader(controller: controller)),
              const SizedBox(height: AgroDesign.sectionGap),
              const Reveal(
                index: 4,
                child: SectionHeading(title: 'Preferências'),
              ),
              const SizedBox(height: 12),
              Reveal(
                index: 5,
                child: AgroSurface(
                  padding: const EdgeInsets.symmetric(vertical: 6),
                  child: Column(
                    children: [
                      _SwitchRow(
                        icon: Icons.text_increase,
                        title: 'Texto maior',
                        subtitle: 'Aumenta as letras do aplicativo',
                        value: prefs.largerText,
                        onChanged: (v) => saveProfilePrefs(
                          controller,
                          appPrefs.value.copyWith(largerText: v),
                        ),
                      ),
                      const Divider(indent: 72, endIndent: 16),
                      _SwitchRow(
                        icon: Icons.motion_photos_off_outlined,
                        title: 'Reduzir animações',
                        subtitle: 'Telas aparecem sem movimento',
                        value: prefs.reduceMotion,
                        onChanged: (v) => saveProfilePrefs(
                          controller,
                          appPrefs.value.copyWith(reduceMotion: v),
                        ),
                      ),
                      const Divider(indent: 72, endIndent: 16),
                      _InfoRow(
                        icon: canWrite
                            ? Icons.verified_user_outlined
                            : Icons.visibility_outlined,
                        title: canWrite
                            ? 'Permissão de registro verificada pelo servidor.'
                            : 'Acesso de consulta.',
                      ),
                    ],
                  ),
                ),
              ),
              if (onLogout != null) ...[
                const SizedBox(height: 16),
                Reveal(
                  index: 6,
                  child: TextButton.icon(
                    style: TextButton.styleFrom(
                      foregroundColor: AgroDesign.danger,
                      minimumSize: const Size(48, 52),
                    ),
                    onPressed: onLogout,
                    icon: const Icon(Icons.logout),
                    label: const Text('Sair da conta'),
                  ),
                ),
              ],
            ],
          ),
        ),
      );
    },
  );
}

class _SwitchRow extends StatelessWidget {
  final IconData icon;
  final String title, subtitle;
  final bool value;
  final ValueChanged<bool> onChanged;
  const _SwitchRow({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.value,
    required this.onChanged,
  });
  @override
  Widget build(BuildContext context) => MergeSemantics(
    child: ListTile(
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      leading: IconBubble(icon, size: 40),
      title: Text(
        title,
        style: AgroDesign.body.copyWith(fontWeight: FontWeight.w700),
      ),
      subtitle: Text(subtitle, style: AgroDesign.caption),
      trailing: Switch(
        value: value,
        activeTrackColor: AgroDesign.forest,
        onChanged: onChanged,
      ),
      onTap: () => onChanged(!value),
    ),
  );
}

class _InfoRow extends StatelessWidget {
  final IconData icon;
  final String title;
  const _InfoRow({required this.icon, required this.title});
  @override
  Widget build(BuildContext context) => ListTile(
    contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
    leading: IconBubble(icon, size: 40),
    title: Text(title, style: AgroDesign.body),
  );
}

class EditProfilePage extends StatefulWidget {
  final HomeController controller;
  const EditProfilePage({super.key, required this.controller});
  @override
  State<EditProfilePage> createState() => _EditProfilePageState();
}

class _EditProfilePageState extends State<EditProfilePage> {
  late final ProfilePrefs initial = appPrefs.value;
  late final name = TextEditingController(text: initial.displayName);
  late final about = TextEditingController(text: initial.about);
  late int tone = initial.avatarTone;
  late final Set<String> crops = {...initial.crops};
  bool saved = false;

  List<String> get cropOptions => [
    for (final c in rows(widget.controller.catalog['crops']))
      if (c['name'] is String) c['name'] as String,
  ];

  @override
  void dispose() {
    name.dispose();
    about.dispose();
    super.dispose();
  }

  Future<void> save() async {
    await saveProfilePrefs(
      widget.controller,
      appPrefs.value.copyWith(
        displayName: name.text.trim(),
        about: about.text.trim(),
        avatarTone: tone,
        crops: [
          for (final c in cropOptions)
            if (crops.contains(c)) c,
        ],
      ),
    );
    if (!mounted) return;
    setState(() => saved = true);
    // O botão confirma em si mesmo antes de voltar.
    await Future<void>.delayed(
      AgroMotion.of(context, const Duration(milliseconds: 650)),
    );
    if (mounted) Navigator.pop(context);
  }

  @override
  Widget build(BuildContext context) {
    final preview = name.text.trim().isNotEmpty
        ? name.text.trim()
        : widget.controller.repository.organizationName;
    final options = cropOptions;
    return Scaffold(
      appBar: AppBar(title: const Text('Editar perfil')),
      body: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 640),
          child: ListView(
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
            children: [
              Reveal(
                child: Column(
                  children: [
                    ProfileAvatar(name: preview, tone: tone, size: 96),
                    const SizedBox(height: 16),
                    Semantics(
                      label: 'Cor do avatar',
                      child: Wrap(
                        alignment: WrapAlignment.center,
                        spacing: 4,
                        children: [
                          for (var i = 0; i < avatarTones.length; i++)
                            Semantics(
                              button: true,
                              selected: tone == i,
                              label: 'Cor ${i + 1}',
                              child: InkResponse(
                                onTap: () => setState(() => tone = i),
                                radius: 26,
                                child: SizedBox(
                                  width: 48,
                                  height: 48,
                                  child: Center(
                                    child: AnimatedContainer(
                                      duration: AgroMotion.of(
                                        context,
                                        AgroMotion.stateDuration,
                                      ),
                                      curve: AgroMotion.respond,
                                      width: tone == i ? 34 : 28,
                                      height: tone == i ? 34 : 28,
                                      decoration: BoxDecoration(
                                        color: avatarTones[i],
                                        shape: BoxShape.circle,
                                        border: Border.all(
                                          color: tone == i
                                              ? AgroDesign.paper
                                              : Colors.transparent,
                                          width: 3,
                                        ),
                                        boxShadow: tone == i
                                            ? [
                                                BoxShadow(
                                                  color: avatarTones[i],
                                                  spreadRadius: 2,
                                                ),
                                              ]
                                            : null,
                                      ),
                                    ),
                                  ),
                                ),
                              ),
                            ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),
              Reveal(
                index: 1,
                child: TextField(
                  controller: name,
                  maxLength: 40,
                  textCapitalization: TextCapitalization.words,
                  decoration: const InputDecoration(
                    labelText: 'Como quer ser chamado',
                    prefixIcon: Icon(Icons.person_outline),
                  ),
                  onChanged: (_) => setState(() {}),
                ),
              ),
              const SizedBox(height: 8),
              Reveal(
                index: 2,
                child: TextField(
                  controller: about,
                  maxLength: 140,
                  minLines: 2,
                  maxLines: 4,
                  textCapitalization: TextCapitalization.sentences,
                  decoration: const InputDecoration(
                    labelText: 'Sobre sua produção',
                    hintText: 'Ex.: Hortaliças orgânicas, colheita semanal.',
                    alignLabelWithHint: true,
                  ),
                ),
              ),
              const SizedBox(height: 8),
              Reveal(
                index: 3,
                child: AgroSurface(
                  padding: const EdgeInsets.fromLTRB(16, 16, 16, 12),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'O que você cultiva',
                        style: AgroDesign.section,
                      ),
                      const SizedBox(height: 4),
                      const Text(
                        'Aparece no seu perfil.',
                        style: AgroDesign.caption,
                      ),
                      const SizedBox(height: 12),
                      if (options.isEmpty)
                        const Text(
                          'Nenhuma cultura disponível no catálogo.',
                          style: AgroDesign.body,
                        )
                      else
                        Wrap(
                          spacing: 8,
                          runSpacing: 4,
                          children: [
                            for (final crop in options)
                              FilterChip(
                                label: Text(crop),
                                selected: crops.contains(crop),
                                showCheckmark: true,
                                checkmarkColor: AgroDesign.forest,
                                selectedColor: AgroDesign.mint,
                                backgroundColor: AgroDesign.paper,
                                side: BorderSide(
                                  color: crops.contains(crop)
                                      ? AgroDesign.forest
                                      : AgroDesign.line,
                                ),
                                shape: const StadiumBorder(),
                                labelStyle: const TextStyle(
                                  color: AgroDesign.ink,
                                  fontWeight: FontWeight.w700,
                                ),
                                onSelected: (on) => setState(
                                  () =>
                                      on ? crops.add(crop) : crops.remove(crop),
                                ),
                              ),
                          ],
                        ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 16),
              Reveal(
                index: 4,
                child: AgroSurface(
                  padding: const EdgeInsets.all(16),
                  child: Row(
                    children: [
                      const IconBubble(Icons.lock_outline, size: 40),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              widget.controller.repository.organizationName,
                              style: AgroDesign.body.copyWith(
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                            const Text(
                              'Organização e vínculo são definidos pelo servidor.',
                              style: AgroDesign.caption,
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 24),
              Reveal(
                index: 5,
                child: PressScale(
                  child: FilledButton(
                    onPressed: saved ? () {} : save,
                    style: FilledButton.styleFrom(
                      backgroundColor: saved
                          ? AgroDesign.green
                          : AgroDesign.forest,
                    ),
                    child: AnimatedSwitcher(
                      duration: AgroMotion.of(
                        context,
                        const Duration(milliseconds: 200),
                      ),
                      transitionBuilder: (child, animation) => FadeTransition(
                        opacity: animation,
                        child: ScaleTransition(
                          scale: Tween(begin: .9, end: 1.0).animate(animation),
                          child: child,
                        ),
                      ),
                      child: saved
                          ? const Row(
                              key: ValueKey('saved'),
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(Icons.check_rounded, size: 20),
                                SizedBox(width: 8),
                                Text('Perfil salvo'),
                              ],
                            )
                          : const Text(
                              'Salvar alterações',
                              key: ValueKey('save'),
                            ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
