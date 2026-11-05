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
  scaffoldBackgroundColor: const Color(0xFFFAF8F2),
  colorScheme: ColorScheme.fromSeed(
    seedColor: const Color(0xFF24563C),
    primary: const Color(0xFF24563C),
    surface: const Color(0xFFFAF8F2),
  ),
  textTheme: const TextTheme(
    bodyMedium: TextStyle(fontSize: 16, height: 1.45, color: Color(0xFF243A2D)),
    titleLarge: TextStyle(
      fontSize: 23,
      fontWeight: FontWeight.bold,
      color: Color(0xFF193F2B),
    ),
    titleMedium: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
  ),
  cardTheme: CardThemeData(
    elevation: 0,
    color: Colors.white,
    shape: RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(22),
      side: const BorderSide(color: Color(0xFFE1E6DA)),
    ),
  ),
  inputDecorationTheme: InputDecorationTheme(
    filled: true,
    fillColor: Colors.white,
    border: OutlineInputBorder(borderRadius: BorderRadius.circular(14)),
  ),
  filledButtonTheme: FilledButtonThemeData(
    style: FilledButton.styleFrom(
      minimumSize: const Size(48, 52),
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
    ),
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
              const Icon(
                Icons.eco_outlined,
                size: 56,
                color: Color(0xFF24563C),
              ),
              const SizedBox(height: 16),
              Text(
                'Agro+ Brasil',
                style: Theme.of(context).textTheme.headlineMedium,
              ),
              const SizedBox(height: 8),
              const Text('Seu dia no campo, com mais clareza.'),
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
    if (destination == 'production-new' || destination == 'offer-new') {
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
      appBar: AppBar(
        toolbarHeight: MediaQuery.textScalerOf(context).scale(18) > 27
            ? 80
            : 64,
        title: const Row(
          children: [
            Icon(Icons.eco, color: Color(0xFF24563C)),
            SizedBox(width: 8),
            Flexible(
              child: Text(
                'Agro+ Brasil',
                maxLines: 2,
                style: TextStyle(
                  fontSize: 18,
                  height: 1,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
          ],
        ),
        actions: [
          IconButton(
            tooltip: 'Atualizar informações',
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
                    builder: (_) =>
                        galleryEnabled ? const Gallery() : const SessionPage(),
                  ),
                  (_) => false,
                );
              }
            },
            icon: const Icon(Icons.logout),
          ),
        ],
      ),
      body: selected == 0
          ? HomeScreen(controller: controller, onNavigate: navigate)
          : selected == 4
          ? ProfilePage(controller: controller)
          : TaskPage(
              key: ValueKey('$selected:$focusId:${controller.propertyId}'),
              controller: controller,
              kind: ['home', 'production', 'offers', 'orders'][selected],
              focusId: focusId,
            ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: selected,
        onDestinationSelected: (index) => setState(() {
          selected = index;
          focusId = null;
        }),
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.home_outlined),
            selectedIcon: Icon(Icons.home),
            label: 'Início',
          ),
          NavigationDestination(icon: Icon(Icons.grass), label: 'Produção'),
          NavigationDestination(
            icon: Icon(Icons.sell_outlined),
            label: 'Ofertas',
          ),
          NavigationDestination(
            icon: Icon(Icons.inventory_2_outlined),
            label: 'Pedidos',
          ),
          NavigationDestination(
            icon: Icon(Icons.person_outline),
            label: 'Perfil',
          ),
        ],
      ),
    ),
  );
}
