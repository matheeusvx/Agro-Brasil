import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/semantics.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:http/http.dart' as http;

import 'data.dart';
import 'demo.dart';
import 'home.dart';
import 'tasks.dart';
import 'design.dart';
import 'desktop.dart';
import 'motion.dart';
import 'profile.dart';
import 'territorial/water_dashboard.dart';

const galleryEnabled = bool.fromEnvironment('DEMO_GALLERY');
Uri apiBase() {
  const configured = String.fromEnvironment('API_BASE_URL');
  return Uri.parse(
    configured.isNotEmpty
        ? configured
        : Uri.base.host.isNotEmpty
        ? Uri.base.origin
        : 'http://127.0.0.1:3000',
  );
}

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  // Mantém a árvore semântica disponível no navegador durante toda a aplicação.
  if (kIsWeb) {
    SemanticsBinding.instance.ensureSemantics();
  }
  runApp(const AgroApp());
}

ThemeData agroTheme() => ThemeData(
  useMaterial3: true,
  fontFamily: 'Roboto',
  scaffoldBackgroundColor: AgroDesign.canvas,
  colorScheme: ColorScheme.fromSeed(
    seedColor: AgroDesign.forest,
    primary: AgroDesign.forest,
    surface: AgroDesign.canvas,
    error: AgroDesign.danger,
  ),
  dividerTheme: const DividerThemeData(color: AgroDesign.line, space: 1),
  progressIndicatorTheme: const ProgressIndicatorThemeData(
    color: AgroDesign.brand,
    linearTrackColor: AgroDesign.mint,
  ),
  snackBarTheme: SnackBarThemeData(
    behavior: SnackBarBehavior.floating,
    backgroundColor: AgroDesign.forest,
    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
  ),
  checkboxTheme: CheckboxThemeData(
    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
  ),
  expansionTileTheme: const ExpansionTileThemeData(
    shape: Border(),
    collapsedShape: Border(),
  ),
  appBarTheme: const AppBarTheme(
    backgroundColor: AgroDesign.canvas,
    foregroundColor: AgroDesign.ink,
    scrolledUnderElevation: 0,
    elevation: 0,
    centerTitle: false,
    titleTextStyle: TextStyle(
      fontFamily: 'Roboto',
      fontSize: 19,
      fontWeight: FontWeight.w700,
      color: AgroDesign.ink,
    ),
  ),
  textTheme: const TextTheme(
    bodyMedium: AgroDesign.body,
    titleLarge: AgroDesign.title,
    titleMedium: AgroDesign.section,
  ),
  cardTheme: CardThemeData(
    elevation: 0,
    color: Colors.white,
    margin: const EdgeInsets.only(bottom: 14),
    shape: RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(AgroDesign.radius),
    ),
  ),
  inputDecorationTheme: InputDecorationTheme(
    filled: true,
    fillColor: Colors.white,
    contentPadding: const EdgeInsets.symmetric(horizontal: 18, vertical: 18),
    labelStyle: const TextStyle(color: AgroDesign.muted),
    helperMaxLines: 4,
    errorMaxLines: 4,
    enabledBorder: OutlineInputBorder(
      borderRadius: BorderRadius.circular(16),
      borderSide: const BorderSide(color: AgroDesign.line),
    ),
    focusedBorder: OutlineInputBorder(
      borderRadius: BorderRadius.circular(16),
      borderSide: const BorderSide(color: AgroDesign.forest, width: 1.6),
    ),
    border: OutlineInputBorder(borderRadius: BorderRadius.circular(16)),
  ),
  filledButtonTheme: FilledButtonThemeData(
    style: FilledButton.styleFrom(
      backgroundColor: AgroDesign.forest,
      foregroundColor: Colors.white,
      disabledBackgroundColor: AgroDesign.disabled,
      disabledForegroundColor: AgroDesign.muted,
      minimumSize: const Size(48, 54),
      textStyle: const TextStyle(
        fontFamily: 'Roboto',
        fontSize: 15,
        fontWeight: FontWeight.w700,
      ),
      shape: const StadiumBorder(),
      padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 16),
    ),
  ),
  outlinedButtonTheme: OutlinedButtonThemeData(
    style: OutlinedButton.styleFrom(
      foregroundColor: AgroDesign.forest,
      backgroundColor: Colors.white,
      side: const BorderSide(color: AgroDesign.line, width: 1.2),
      minimumSize: const Size(48, 54),
      textStyle: const TextStyle(
        fontFamily: 'Roboto',
        fontSize: 15,
        fontWeight: FontWeight.w700,
      ),
      shape: const StadiumBorder(),
    ),
  ),
  dialogTheme: DialogThemeData(
    backgroundColor: AgroDesign.paper,
    surfaceTintColor: Colors.transparent,
    shape: RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(AgroDesign.radius),
    ),
  ),
  bottomSheetTheme: const BottomSheetThemeData(
    backgroundColor: AgroDesign.paper,
    surfaceTintColor: Colors.transparent,
  ),
  textButtonTheme: TextButtonThemeData(
    style: TextButton.styleFrom(minimumSize: const Size(48, 48)),
  ),
);

class AgroApp extends StatelessWidget {
  final HomeController? controller;
  const AgroApp({super.key, this.controller});
  @override
  Widget build(BuildContext context) => MaterialApp(
    title: 'Agro+ Brasil',
    debugShowCheckedModeBanner: false,
    theme: agroTheme(),
    builder: applyProfilePrefs,
    locale: const Locale('pt', 'BR'),
    supportedLocales: const [Locale('pt', 'BR')],
    localizationsDelegates: GlobalMaterialLocalizations.delegates,
    home: controller != null
        ? AppShell(controller: controller!)
        : galleryEnabled
        ? const Gallery()
        : const SessionPage(),
  );
}

class SessionPage extends StatefulWidget {
  const SessionPage({super.key});
  @override
  State<SessionPage> createState() => _SessionPageState();
}

class _SessionPageState extends State<SessionPage> {
  final token = TextEditingController();
  String? error;
  bool busy = false;
  bool showToken = false;
  Json? identity;
  List<Json> memberships = [];
  String? organization;
  @override
  void dispose() {
    token.dispose();
    super.dispose();
  }

  Future<void> authenticate() async {
    setState(() {
      busy = true;
      error = null;
      identity = null;
    });
    try {
      final base = apiBase();
      if (!['127.0.0.1', 'localhost', '::1'].contains(base.host) ||
          base.scheme != 'http') {
        throw ApiFailure(
          0,
          'Demonstração disponível somente no servidor local.',
        );
      }
      final response = await http
          .get(
            base.resolve('/api/v1/me'),
            headers: {'Authorization': 'Bearer ${token.text.trim()}'},
          )
          .timeout(const Duration(seconds: 12));
      final data = jsonDecode(response.body) as Json;
      if (response.statusCode != 200) {
        throw ApiFailure(
          response.statusCode,
          data['error']?['message'] ?? 'Acesso não autorizado.',
        );
      }
      final allowed = rows(data['memberships'])
          .where((m) => m['type'] == 'PEQUENO_PRODUTOR_RURAL')
          .toList();
      if (allowed.isEmpty) {
        throw ApiFailure(
          403,
          'O usuário não tem vínculo de pequeno produtor rural.',
        );
      }
      if (!mounted) return;
      setState(() {
        identity = data;
        memberships = allowed;
        organization = allowed.first['organizationId'];
      });
    } catch (failure) {
      if (mounted) {
        setState(
          () => error = failure is ApiFailure
              ? failure.message
              : 'Serviço indisponível. Tente novamente.',
        );
      }
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  void enter() {
    final member = memberships.firstWhere(
      (m) => m['organizationId'] == organization,
    );
    final repo = ApiRepository(
      base: apiBase(),
      token: token.text.trim(),
      organizationId: organization!,
      userId: identity!['userId'],
      organizationName: member['name'],
      organizations: memberships,
      demonstration: identity!['isDemonstration'] == true,
    );
    token.clear();
    Navigator.of(context).pushReplacement(
      MaterialPageRoute<void>(
        builder: (_) =>
            AppShell(controller: HomeController(repo, LocalStore())),
      ),
    );
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: AgroDesign.forest,
    body: LayoutBuilder(
      builder: (context, box) {
        final wide = box.maxWidth >= 600;
        final sheet = Reveal(
          index: 3,
          offset: 28,
          child: Container(
            width: double.infinity,
            decoration: BoxDecoration(
              color: AgroDesign.canvas,
              borderRadius: wide
                  ? BorderRadius.circular(32)
                  : const BorderRadius.vertical(top: Radius.circular(32)),
            ),
            padding: EdgeInsets.fromLTRB(
              24,
              32,
              24,
              24 + MediaQuery.paddingOf(context).bottom,
            ),
            child: Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 420),
                child: _form(),
              ),
            ),
          ),
        );
        return SingleChildScrollView(
          child: ConstrainedBox(
            constraints: BoxConstraints(minHeight: box.maxHeight),
            child: Column(
              mainAxisAlignment: wide
                  ? MainAxisAlignment.center
                  : MainAxisAlignment.spaceBetween,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // Com spaceBetween, a marca fica centrada no espaço livre.
                if (!wide) const SizedBox.shrink(),
                SafeArea(
                  bottom: false,
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(24, 32, 24, 32),
                    child: Column(
                      children: [
                        Reveal(
                          child: Semantics(
                            header: true,
                            child: const AgroLogo(height: 48),
                          ),
                        ),
                        const SizedBox(height: 14),
                        const Reveal(
                          index: 1,
                          child: Text(
                            'Produção, ofertas e entregas em um só lugar.',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              fontSize: 15,
                              height: 1.4,
                              color: Color(0xFFD3E6D8),
                            ),
                          ),
                        ),
                        const SizedBox(height: 28),
                        const Reveal(
                          index: 2,
                          child: Wrap(
                            alignment: WrapAlignment.center,
                            spacing: 10,
                            runSpacing: 10,
                            children: [
                              _BrandPill(Icons.grass, 'Produção'),
                              _BrandPill(Icons.sell_outlined, 'Ofertas'),
                              _BrandPill(
                                Icons.local_shipping_outlined,
                                'Entregas',
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                if (wide)
                  Center(
                    child: ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 480),
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 24),
                        child: sheet,
                      ),
                    ),
                  )
                else
                  sheet,
              ],
            ),
          ),
        );
      },
    ),
  );

  Widget _form() => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      const Text('Meu campo, meu dia.', style: AgroDesign.display),
      const SizedBox(height: 8),
      Text(
        'Da sua colheita a novas conexões. Tudo começa na sua propriedade.',
        style: AgroDesign.body.copyWith(color: AgroDesign.muted),
      ),
      const SizedBox(height: 28),
      TextField(
        controller: token,
        obscureText: !showToken,
        enableSuggestions: false,
        autocorrect: false,
        textInputAction: TextInputAction.go,
        onSubmitted: (_) {
          if (!busy) authenticate();
        },
        decoration: InputDecoration(
          labelText: 'Código de acesso',
          prefixIcon: const Icon(Icons.key_outlined),
          suffixIcon: IconButton(
            tooltip: showToken ? 'Ocultar código' : 'Mostrar código',
            onPressed: () => setState(() => showToken = !showToken),
            icon: Icon(
              showToken
                  ? Icons.visibility_off_outlined
                  : Icons.visibility_outlined,
            ),
          ),
        ),
        onChanged: (_) => setState(() => identity = null),
      ),
      const SizedBox(height: 16),
      PressScale(
        child: FilledButton(
          onPressed: busy ? null : authenticate,
          child: AnimatedSwitcher(
            duration: AgroMotion.of(context, AgroMotion.stateDuration),
            child: busy
                ? const Row(
                    key: ValueKey('busy'),
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: AgroDesign.muted,
                        ),
                      ),
                      SizedBox(width: 10),
                      Text('Verificando acesso…'),
                    ],
                  )
                : const Text('Verificar acesso', key: ValueKey('idle')),
          ),
        ),
      ),
      AnimatedSize(
        duration: AgroMotion.of(context, AgroMotion.respondDuration),
        curve: AgroMotion.respond,
        alignment: Alignment.topCenter,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (error != null) ...[
              const SizedBox(height: 16),
              Semantics(
                liveRegion: true,
                child: Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: AgroDesign.dangerWash,
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Icon(
                        Icons.error_outline,
                        size: 20,
                        color: AgroDesign.danger,
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          error!,
                          style: AgroDesign.body.copyWith(
                            color: AgroDesign.danger,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
            if (identity != null) ...[
              const SizedBox(height: 24),
              const Row(
                children: [
                  IconBubble(
                    Icons.check,
                    background: AgroDesign.brandWash,
                    color: AgroDesign.green,
                    size: 36,
                  ),
                  SizedBox(width: 12),
                  Expanded(
                    child: Text('Acesso verificado', style: AgroDesign.section),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              DropdownButtonFormField<String>(
                initialValue: organization,
                isExpanded: true,
                decoration: const InputDecoration(
                  labelText: 'Organização autorizada',
                  prefixIcon: Icon(Icons.agriculture_outlined),
                ),
                items: memberships
                    .map(
                      (m) => DropdownMenuItem<String>(
                        value: m['organizationId'],
                        child: Text(m['name'], overflow: TextOverflow.ellipsis),
                      ),
                    )
                    .toList(),
                onChanged: (value) => setState(() => organization = value),
              ),
              const SizedBox(height: 16),
              PressScale(
                child: FilledButton.icon(
                  onPressed: enter,
                  icon: const Icon(Icons.arrow_forward, size: 18),
                  label: const Text('Entrar na minha propriedade'),
                ),
              ),
            ],
          ],
        ),
      ),
    ],
  );
}

/// Rótulo discreto sobre o verde da tela de entrada.
class _BrandPill extends StatelessWidget {
  final IconData icon;
  final String label;
  const _BrandPill(this.icon, this.label);
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
    decoration: BoxDecoration(
      color: const Color(0x14FFFFFF),
      borderRadius: BorderRadius.circular(999),
      border: Border.all(color: const Color(0x26FFFFFF)),
    ),
    child: Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 16, color: AgroDesign.brand),
        const SizedBox(width: 6),
        Text(
          label,
          style: const TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w700,
            color: Colors.white,
          ),
        ),
      ],
    ),
  );
}

class Gallery extends StatelessWidget {
  const Gallery({super.key});
  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Galeria · dados fictícios')),
    body: ListView(
      children: scenarios
          .map(
            (s) => ListTile(
              title: Text(s),
              trailing: const Icon(Icons.chevron_right),
              onTap: () => Navigator.push(
                context,
                MaterialPageRoute<void>(
                  builder: (_) => AppShell(controller: demoController(s)),
                ),
              ),
            ),
          )
          .toList(),
    ),
  );
}

class AppShell extends StatefulWidget {
  final HomeController controller;
  const AppShell({super.key, required this.controller});
  @override
  State<AppShell> createState() => _AppShellState();
}

class _AppShellState extends State<AppShell> {
  int selected = 0;
  String? focusId;
  HomeController get controller => widget.controller;
  @override
  void initState() {
    super.initState();
    loadProfilePrefs(controller);
    controller.start();
  }

  Future<void> logout() async {
    await controller.clear();
    appPrefs.value = const ProfilePrefs();
    if (mounted) {
      Navigator.pushAndRemoveUntil(
        context,
        MaterialPageRoute<void>(
          builder: (_) =>
              galleryEnabled ? const Gallery() : const SessionPage(),
        ),
        (_) => false,
      );
    }
  }

  @override
  void dispose() {
    controller.dispose();
    super.dispose();
  }

  Future<void> navigate(String destination) async {
    if (destination == 'water-dashboard') {
      await Navigator.push(
        context,
        MaterialPageRoute<void>(builder: (_) => const WaterDashboard()),
      );
    } else if (destination == 'production-new' || destination == 'offer-new') {
      await Navigator.push(
        context,
        MaterialPageRoute<void>(
          builder: (_) => EntryPage(
            controller: controller,
            kind: destination == 'production-new' ? 'production' : 'offer',
          ),
        ),
      );
      if (mounted && controller.propertyId != null) {
        await controller.load(controller.propertyId!);
      }
    } else if (destination == 'lots') {
      await Navigator.push(
        context,
        MaterialPageRoute<void>(
          builder: (_) => Scaffold(
            appBar: AppBar(title: const Text('Rastrear lote')),
            body: TaskPage(controller: controller, kind: 'lots'),
          ),
        ),
      );
    } else if (destination.startsWith('lot:')) {
      await Navigator.push(
        context,
        MaterialPageRoute<void>(
          builder: (_) => HistoryPage(
            controller: controller,
            lotId: destination.substring(4),
          ),
        ),
      );
    } else {
      setState(() {
        selected = 3;
        focusId = destination.startsWith('order:')
            ? destination.substring(6)
            : null;
      });
    }
  }

  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: controller,
    builder: (context, _) => Scaffold(
      appBar: MediaQuery.sizeOf(context).width >= 1000
          ? null
          : AppBar(
              backgroundColor: AgroDesign.forest,
              foregroundColor: Colors.white,
              toolbarHeight: MediaQuery.textScalerOf(context).scale(18) > 27
                  ? 80
                  : 64,
              title: const AgroLogo(),
              actions: [
                IconButton(
                  tooltip: 'Inteligência hídrica territorial',
                  onPressed: () => navigate('water-dashboard'),
                  icon: const Icon(Icons.water_drop_outlined),
                ),
                IconButton(
                  tooltip: 'Atualizar informações',
                  disabledColor: Colors.white54,
                  onPressed: controller.loading || controller.propertyId == null
                      ? null
                      : () => controller.load(controller.propertyId!),
                  icon: const Icon(Icons.refresh),
                ),
                IconButton(
                  tooltip: 'Sair e apagar dados salvos desta sessão',
                  onPressed: () async {
                    await controller.clear();
                    if (context.mounted) {
                      Navigator.pushAndRemoveUntil(
                        context,
                        MaterialPageRoute<void>(
                          builder: (_) => galleryEnabled
                              ? const Gallery()
                              : const SessionPage(),
                        ),
                        (_) => false,
                      );
                    }
                  },
                  icon: const Icon(Icons.logout),
                ),
              ],
            ),
      body: LayoutBuilder(
        builder: (context, constraints) {
          final content = selected == 0
              ? HomeScreen(controller: controller, onNavigate: navigate)
              : selected == 4
              ? ProfilePage(controller: controller, onLogout: logout)
              : TaskPage(
                  key: ValueKey('$selected:$focusId:${controller.propertyId}'),
                  controller: controller,
                  kind: selected == 5
                      ? 'lots'
                      : ['home', 'production', 'offers', 'orders'][selected],
                  focusId: focusId,
                );
          if (constraints.maxWidth < 1000) return content;
          return DesktopShell(
            controller: controller,
            selected: selected,
            onSelected: (index) => setState(() {
              selected = index;
              focusId = null;
            }),
            onNavigate: navigate,
            onLogout: () async {
              await controller.clear();
              if (context.mounted) {
                Navigator.pushAndRemoveUntil(
                  context,
                  MaterialPageRoute<void>(
                    builder: (_) =>
                        galleryEnabled ? const Gallery() : const SessionPage(),
                  ),
                  (_) => false,
                );
              }
            },
            content: content,
            onOrganization: (id) async {
              final repo = controller.repository;
              if (repo is! ApiRepository) return;
              final member = repo.organizations
                  .where((m) => m['organizationId'] == id)
                  .firstOrNull;
              if (member == null) return;
              final next = ApiRepository(
                base: repo.base,
                token: repo.token,
                userId: repo.userId,
                organizationId: id,
                organizationName: member['name'],
                organizations: repo.organizations,
                demonstration: repo.demonstration,
              );
              await controller.clear();
              if (context.mounted) {
                Navigator.pushReplacement(
                  context,
                  MaterialPageRoute<void>(
                    builder: (_) => AppShell(
                      controller: HomeController(next, LocalStore()),
                    ),
                  ),
                );
              }
            },
          );
        },
      ),
      bottomNavigationBar: MediaQuery.sizeOf(context).width >= 1000
          ? null
          : AgroNavigationBar(
              selected: selected == 5 ? 1 : selected,
              onSelected: (index) => setState(() {
                selected = index;
                focusId = null;
              }),
            ),
    ),
  );
}
