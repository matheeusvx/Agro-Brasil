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
import 'illustrations.dart';
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
  scaffoldBackgroundColor: AgroDesign.cream,
  colorScheme: ColorScheme.fromSeed(
    seedColor: AgroDesign.forest,
    primary: AgroDesign.forest,
    surface: AgroDesign.cream,
    error: AgroDesign.danger,
  ),
  appBarTheme: const AppBarTheme(
    backgroundColor: AgroDesign.cream,
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
    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(22)),
  ),
  inputDecorationTheme: InputDecorationTheme(
    filled: true,
    fillColor: Colors.white,
    contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 18),
    labelStyle: const TextStyle(color: AgroDesign.muted),
    helperMaxLines: 4,
    errorMaxLines: 4,
    enabledBorder: OutlineInputBorder(
      borderRadius: BorderRadius.circular(16),
      borderSide: const BorderSide(color: AgroDesign.line),
    ),
    border: OutlineInputBorder(borderRadius: BorderRadius.circular(16)),
  ),
  filledButtonTheme: FilledButtonThemeData(
    style: FilledButton.styleFrom(
      minimumSize: const Size(48, 52),
      textStyle: const TextStyle(
        fontFamily: 'Roboto',
        fontSize: 15,
        fontWeight: FontWeight.w700,
      ),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
    ),
  ),
  outlinedButtonTheme: OutlinedButtonThemeData(
    style: OutlinedButton.styleFrom(
      foregroundColor: AgroDesign.forest,
      side: const BorderSide(color: AgroDesign.forest),
      minimumSize: const Size(48, 52),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
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
    body: Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 460),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(28),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    ColoredBox(
                      color: AgroDesign.forest,
                      child: Padding(
                        padding: const EdgeInsets.fromLTRB(20, 30, 20, 26),
                        child: Center(
                          child: Semantics(
                            header: true,
                            child: const AgroLogo(height: 56),
                          ),
                        ),
                      ),
                    ),
                    const ColoredBox(
                      color: AgroDesign.sky,
                      child: FarmIllustration(width: 370, height: 150),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),
              const Text('Meu campo, meu dia.', style: AgroDesign.title),
              const SizedBox(height: 8),
              const Text(
                'Da sua colheita a novas conexões. Tudo começa na sua propriedade.',
                style: AgroDesign.body,
              ),
              const SizedBox(height: 24),
              const InfoStrip(
                icon: Icons.science_outlined,
                text: 'Demonstração local · participantes fictícios. Use o token de pequeno produtor rural gerado no servidor.',
              ),
              const SizedBox(height: 20),
              TextField(
                controller: token,
                obscureText: true,
                enableSuggestions: false,
                autocorrect: false,
                decoration: const InputDecoration(
                  labelText: 'Token temporário de demonstração',
                ),
                onChanged: (_) => setState(() => identity = null),
              ),
              const SizedBox(height: 16),
              FilledButton(
                onPressed: busy ? null : authenticate,
                child: Text(busy ? 'Verificando acesso…' : 'Verificar acesso'),
              ),
              if (error != null)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  child: Semantics(
                    liveRegion: true,
                    child: Text(
                      error!,
                      style: const TextStyle(color: Color(0xFF9A271C)),
                    ),
                  ),
                ),
              if (identity != null) ...[
                const SizedBox(height: 16),
                DropdownButtonFormField<String>(
                  initialValue: organization,
                  isExpanded: true,
                  decoration: const InputDecoration(
                    labelText: 'Organização autorizada',
                  ),
                  items: memberships
                      .map(
                        (m) => DropdownMenuItem<String>(
                          value: m['organizationId'],
                          child: Text(
                            m['name'],
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      )
                      .toList(),
                  onChanged: (value) => setState(() => organization = value),
                ),
                const SizedBox(height: 16),
                FilledButton(
                  onPressed: enter,
                  child: const Text('Entrar na minha propriedade'),
                ),
              ],
            ],
          ),
        ),
      ),
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
    controller.start();
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
              ? ProfilePage(controller: controller)
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
