"""EnergyLab - génère les schémas de câblage SVG (web/img/ et docs/img/).

    python tools/diagrams/make_diagrams.py

Les broches viennent de firmware/src/pins.h : si vous changez une broche, modifiez aussi ce script.
"""
import os

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT_DIRS = [os.path.join(ROOT, "web", "img"), os.path.join(ROOT, "docs", "img")]

FONT = "font-family=\"DejaVu Sans, Segoe UI, Arial, sans-serif\""
C5V, C3V, CGND = "#d62828", "#f77f00", "#222222"


class Svg:
    def __init__(self, w, h, title):
        self.w, self.h = w, h
        self.parts = []
        self.title = title

    def add(self, s):
        self.parts.append(s)

    def text(self, x, y, s, size=13, anchor="start", weight="normal", fill="#1f2933", italic=False):
        st = ' font-style="italic"' if italic else ""
        self.add(f'<text x="{x}" y="{y}" font-size="{size}" text-anchor="{anchor}" font-weight="{weight}" fill="{fill}"{st}>{s}</text>')

    def line(self, pts, color="#333", width=2.5, dash=None):
        d = " ".join(f"{x},{y}" for x, y in pts)
        da = f' stroke-dasharray="{dash}"' if dash else ""
        self.add(f'<polyline points="{d}" fill="none" stroke="{color}" stroke-width="{width}" stroke-linejoin="round" stroke-linecap="round"{da}/>')

    def rect(self, x, y, w, h, fill="#fff", stroke="#333", rx=8, width=2, dash=None):
        da = f' stroke-dasharray="{dash}"' if dash else ""
        self.add(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" fill="{fill}" stroke="{stroke}" stroke-width="{width}"{da}/>')

    def dot(self, x, y, color="#333", r=4.5):
        self.add(f'<circle cx="{x}" cy="{y}" r="{r}" fill="{color}"/>')

    def pin(self, x, y, used=True, color="#0e7c66"):
        self.add(f'<circle cx="{x}" cy="{y}" r="5" fill="{color if used else "#fff"}" stroke="{color if used else "#9aa5b1"}" stroke-width="2"/>')

    def flag(self, x, y, net, direction="left"):
        """Pastille d'alimentation (5V, 3V3, GND) au bout d'un fil."""
        color = {"5V": C5V, "3V3": C3V, "GND": CGND}[net]
        w = 40 if net != "GND" else 44
        if direction == "left":
            bx = x - w
        elif direction == "right":
            bx = x
        else:  # up / down : centrée
            bx = x - w / 2
        by = y - 11
        if direction == "up":
            by = y - 22
        if direction == "down":
            by = y
        self.add(f'<rect x="{bx}" y="{by}" width="{w}" height="22" rx="11" fill="{color}"/>')
        self.text(bx + w / 2, by + 15.5, net, 12, "middle", "bold", "#fff")

    def svg(self):
        head = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {self.w} {self.h}" width="{self.w}" height="{self.h}" {FONT}>'
                f'<title>{self.title}</title><rect width="{self.w}" height="{self.h}" fill="#ffffff"/>')
        return head + "".join(self.parts) + "</svg>\n"


# ====================================================================== basse tension
def low_voltage():
    s = Svg(1200, 980, "EnergyLab - câblage basse tension")
    s.text(30, 38, "EnergyLab — câblage basse tension (5 V / 3,3 V)", 22, weight="bold", fill="#0e7c66")
    s.text(30, 62, "À câbler HORS TENSION. Aucun fil de ce schéma ne transporte le 230 V. Les pastilles de même nom (5V, 3V3, GND) sont reliées entre elles.", 13, fill="#7a2e0e")

    # ---- carte ESP32 DevKit V1 (30 broches), antenne en haut, USB en bas
    bx0, bx1, by0, by1 = 480, 660, 255, 695
    s.rect(bx0, by0, bx1 - bx0, by1 - by0, fill="#1d3557", stroke="#0b1d33", rx=10)
    s.rect(bx0 + 40, by0 + 8, 100, 26, fill="#c9d6e3", stroke="#c9d6e3", rx=3)
    s.text(570, by0 + 26, "antenne Wi-Fi", 11, "middle", fill="#1d3557")
    s.text(570, by0 - 10, "ESP32 DevKit V1 (30 broches)", 13, "middle", "bold", "#1d3557")
    s.rect(bx0 + 65, by1, 50, 22, fill="#b0b8c1", stroke="#6b7785", rx=3)
    s.text(570, by1 + 52, "USB (programmation)", 11, "middle", fill="#52606d")
    s.rect(bx0 + 14, by1 + 4, 30, 16, fill="#e9ecef", stroke="#6b7785", rx=3)
    s.text(bx0 + 29, by1 + 34, "EN", 9.5, "middle", "bold", "#52606d")
    s.rect(bx1 - 44, by1 + 4, 30, 16, fill="#e9ecef", stroke="#6b7785", rx=3)
    s.text(bx1 - 29, by1 + 34, "BOOT", 9.5, "middle", "bold", "#52606d")

    left = ["EN", "VP", "VN", "D34", "D35", "D32", "D33", "D25", "D26", "D27", "D14", "D12", "D13", "GND", "VIN"]
    right = ["D23", "D22", "TX0", "RX0", "D21", "D19", "D18", "D5", "TX2", "RX2", "D4", "D2", "D15", "GND", "3V3"]
    used_l = {"D34", "D35", "D32", "D33", "D25", "D26", "D27", "D13", "GND", "VIN"}
    used_r = {"D22", "D21", "TX2", "RX2", "3V3"}
    py = {}
    for i, n in enumerate(left):
        y = 290 + 27 * i
        py["L" + n] = y
        s.pin(bx0, y, n in used_l, "#ffd166")
        s.text(bx0 + 12, y + 4, n + (" (GPIO" + n[1:] + ")" if n.startswith("D") else ""), 10.5, fill="#ffffff")
    for i, n in enumerate(right):
        y = 290 + 27 * i
        py["R" + n] = y
        s.pin(bx1, y, n in used_r, "#ffd166")
        lab = {"TX2": "TX2 (GPIO17)", "RX2": "RX2 (GPIO16)"}.get(n, n + (" (GPIO" + n[1:] + ")" if n.startswith("D") else ""))
        s.text(bx1 - 12, y + 4, lab, 10.5, "end", fill="#ffffff")

    # ---- alimentation de la carte
    s.line([(bx0, py["LGND"]), (456, py["LGND"])], CGND)
    s.flag(456, py["LGND"], "GND")
    s.line([(bx0, py["LVIN"]), (456, py["LVIN"])], C5V)
    s.flag(456, py["LVIN"], "5V")
    s.line([(bx1, py["R3V3"]), (690, py["R3V3"])], C3V)
    s.flag(690, py["R3V3"], "3V3", "right")
    s.text(740, py["R3V3"] + 4, "sortie 3,3 V (capteurs seulement)", 10.5, fill="#52606d")

    # ---- photorésistance (pont diviseur) -> D34
    yl = 205
    s.line([(bx0, py["LD34"]), (445, py["LD34"]), (445, yl)], "#2a9d8f")
    s.dot(445, yl, "#2a9d8f")
    # LDR verticale vers 3V3
    s.line([(445, yl), (445, 186)], "#2a9d8f")
    s.add('<rect x="433" y="146" width="24" height="40" rx="12" fill="#fff3b0" stroke="#7f5539" stroke-width="2"/>')
    s.add('<path d="M437 152 l16 6 l-16 6 l16 6 l-16 6" fill="none" stroke="#7f5539" stroke-width="1.6"/>')
    s.line([(445, 146), (445, 130)], C3V)
    s.flag(445, 130, "3V3", "up")
    s.text(465, 172, "photorésistance (LDR)", 12)
    # 10 kΩ vers GND
    s.line([(445, yl), (470, yl)], "#2a9d8f")
    s.rect(470, yl - 9, 50, 18, fill="#f1e3c8", stroke="#7f5539", rx=3)
    s.text(495, yl - 14, "10 kΩ", 12, "middle")
    s.line([(520, yl), (545, yl)], CGND)
    s.flag(545, yl, "GND", "right")
    s.text(600, yl + 4, "→ D34 : luminosité (entrée analogique)", 11, fill="#2a9d8f")

    # ---- détecteur de présence HC-SR501 -> D35
    s.rect(60, 90, 180, 90, fill="#eef6ff", stroke="#457b9d")
    s.text(150, 112, "Détecteur de présence", 12, "middle", "bold")
    s.text(150, 128, "HC-SR501 (PIR)", 12, "middle")
    for (yy, lab) in ((140, "VCC"), (156, "OUT"), (172, "GND")):
        s.pin(240, yy, True, "#457b9d")
        s.text(232, yy + 4, lab, 10.5, "end")
    s.line([(240, 140), (270, 140)], C5V)
    s.flag(270, 140, "5V", "right")
    s.line([(240, 172), (270, 172)], CGND)
    s.flag(270, 172, "GND", "right")
    s.line([(240, 156), (410, 156), (410, py["LD35"]), (bx0, py["LD35"])], "#457b9d")
    s.text(365, 151, "OUT → D35", 11, "middle", fill="#457b9d")

    # ---- module 4 relais -> D32, D33, D25, D26
    s.rect(50, 400, 250, 160, fill="#e8f4ea", stroke="#2d6a4f")
    s.text(175, 422, "Module 4 relais 5 V", 13, "middle", "bold")
    s.text(175, 438, "actif à l'état bas, optocoupleurs", 10.5, "middle", fill="#52606d")
    for k in range(4):
        x = 66 + 44 * k
        s.rect(x, 450, 36, 30, fill="#3a86ff", stroke="#1d4ed8", rx=3)
        s.text(x + 18, 470, "K" + str(k + 1), 11, "middle", "bold", "#fff")
    s.text(66, 498, "bornes COM / NO : voir schéma 230 V", 10.5, fill="#9b2226")
    s.text(66, 514, "cavalier JD-VCC laissé en place", 10.5, fill="#52606d")
    sig = [("IN4", "LD32", "#8338ec"), ("IN3", "LD33", "#ff006e"), ("IN2", "LD25", "#fb5607"), ("IN1", "LD26", "#3a86ff")]
    for lab, key, col in sig:
        y = py[key]
        s.pin(300, y, True, "#2d6a4f")
        s.text(292, y + 4, lab, 10.5, "end", "bold")
        s.line([(300, y), (bx0, y)], col)
    s.text(390, py["LD32"] - 6, "IN4 → D32", 10, "middle", fill="#8338ec")
    s.text(390, py["LD33"] - 6, "IN3 → D33", 10, "middle", fill="#ff006e")
    s.text(390, py["LD25"] - 6, "IN2 → D25", 10, "middle", fill="#fb5607")
    s.text(390, py["LD26"] - 6, "IN1 → D26", 10, "middle", fill="#3a86ff")
    for (xx, lab, net) in ((110, "VCC", "5V"), (190, "GND", "GND")):
        s.pin(xx, 560, True, "#2d6a4f")
        s.text(xx, 552, lab, 10.5, "middle", "bold")
        s.line([(xx, 560), (xx, 585)], C5V if net == "5V" else CGND)
        s.flag(xx, 585, net, "down")

    # ---- DHT22 -> D27
    s.rect(60, 640, 160, 90, fill="#fff4e6", stroke="#e76f51")
    s.text(140, 662, "DHT22 / AM2302", 12, "middle", "bold")
    s.text(140, 678, "température, humidité", 10.5, "middle", fill="#52606d")
    for (yy, lab) in ((690, "VCC"), (705, "DATA"), (720, "GND")):
        s.pin(220, yy, True, "#e76f51")
        s.text(212, yy + 4, lab, 10, "end")
    s.line([(220, 690), (250, 690)], C3V)
    s.flag(250, 690, "3V3", "right")
    s.line([(220, 720), (250, 720)], CGND)
    s.flag(250, 720, "GND", "right")
    s.line([(220, 705), (380, 705), (380, py["LD27"]), (bx0, py["LD27"])], "#e76f51")
    s.text(330, 700, "DATA → D27", 10.5, "middle", fill="#e76f51")
    s.text(60, 748, "capteur nu (4 pattes) : ajouter 10 kΩ entre DATA et 3V3", 10.5, fill="#52606d")

    # ---- buzzer -> D13
    s.rect(60, 780, 160, 75, fill="#f3e8ff", stroke="#7b2cbf")
    s.text(140, 800, "Buzzer piézo passif", 12, "middle", "bold")
    s.add('<circle cx="100" cy="830" r="11" fill="#222" stroke="#7b2cbf" stroke-width="2"/>')
    for (yy, lab) in ((820, "+"), (842, "−")):
        s.pin(220, yy, True, "#7b2cbf")
        s.text(212, yy + 4, lab, 12, "end", "bold")
    s.line([(220, 842), (250, 842)], CGND)
    s.flag(250, 842, "GND", "right")
    s.line([(220, 820), (395, 820), (395, py["LD13"]), (bx0, py["LD13"])], "#7b2cbf")
    s.text(330, 815, "+ → D13", 10.5, "middle", fill="#7b2cbf")

    # ---- écran OLED I2C -> D21 (SDA), D22 (SCL)
    s.rect(760, 255, 170, 135, fill="#f1f3f5", stroke="#495057")
    s.rect(800, 284, 110, 48, fill="#0b132b", stroke="#495057", rx=4)
    s.text(855, 304, "EnergyLab", 11, "middle", "bold", "#7bdff2")
    s.text(855, 320, "1 234 W", 10, "middle", fill="#7bdff2")
    s.text(845, 362, "Écran OLED I2C 0,96\"", 11.5, "middle", "bold")
    s.text(845, 378, "SSD1306 (ou SH1106 1,3\")", 10.5, "middle", fill="#52606d")
    for (xx, lab, net) in ((790, "VCC", "3V3"), (840, "GND", "GND")):
        s.pin(xx, 255, True, "#495057")
        s.text(xx, 272, lab, 10, "middle", "bold")
        s.line([(xx, 255), (xx, 232)], C3V if net == "3V3" else CGND)
        s.flag(xx, 232, net, "up")
    s.pin(760, py["RD22"], True, "#495057")
    s.text(768, py["RD22"] + 4, "SCL", 10, "start", "bold")
    s.line([(bx1, py["RD22"]), (760, py["RD22"])], "#118ab2")
    s.text(712, py["RD22"] - 6, "D22 → SCL", 10, "middle", fill="#118ab2")
    s.pin(760, py["RD21"], True, "#495057")
    s.text(768, py["RD21"] + 4, "SDA", 10, "start", "bold")
    s.line([(bx1, py["RD21"]), (760, py["RD21"])], "#06d6a0")
    s.text(712, py["RD21"] - 6, "D21 → SDA", 10, "middle", fill="#06a77d")

    # ---- convertisseur de niveau BSS138 (3,3 V <-> 5 V)
    lx0, lx1, ly0, ly1 = 760, 900, 470, 575
    s.rect(lx0, ly0, lx1 - lx0, ly1 - ly0, fill="#fff8e1", stroke="#b08900")
    s.text(830, 522, "BSS138", 11, "middle", "bold", "#7a5c00")
    for (xx, lab, net) in ((780, "LV", "3V3"), (880, "HV", "5V")):
        s.pin(xx, ly0, True, "#b08900")
        s.text(xx, ly0 + 18, lab, 10, "middle", "bold")
        s.line([(xx, ly0), (xx, 425)], C3V if net == "3V3" else C5V)
        s.flag(xx, 425, net, "up")
    s.pin(830, ly1, True, "#b08900")
    s.text(830, ly1 - 8, "GND", 10, "middle", "bold")
    s.line([(830, ly1), (830, 598)], CGND)
    s.flag(830, 598, "GND", "down")
    s.text(810, 638, "Convertisseur de niveau 3,3 V ↔ 5 V", 10.5, "middle", "bold", "#7a5c00")
    s.text(810, 652, "(relier aussi le 2ᵉ GND s'il existe)", 10, "middle", fill="#52606d")
    for (key, lab_l, lab_h, col) in (("RTX2", "LV1", "HV1", "#2b9348"), ("RRX2", "LV2", "HV2", "#1d4ed8")):
        y = py[key]
        s.pin(lx0, y, True, "#b08900")
        s.text(lx0 + 8, y + 4, lab_l, 10, "start", "bold")
        s.pin(lx1, y, True, "#b08900")
        s.text(lx1 - 8, y + 4, lab_h, 10, "end", "bold")
        s.line([(bx1, y), (lx0, y)], col)
    s.text(712, py["RTX2"] - 6, "TX2 → LV1", 10, "middle", fill="#2b9348")
    s.text(712, py["RRX2"] - 6, "RX2 ← LV2", 10, "middle", fill="#1d4ed8")

    # ---- bus série des 4 PZEM-004T
    xr, xt = 955, 980  # bus RX (vers les RX des PZEM) et bus TX (depuis les TX des PZEM)
    tops = [240, 360, 480, 600]
    s.line([(lx1, py["RTX2"]), (xr, py["RTX2"])], "#2b9348")
    s.dot(xr, py["RTX2"], "#2b9348")
    s.line([(lx1, py["RRX2"]), (xt, py["RRX2"])], "#1d4ed8")
    s.dot(xt, py["RRX2"], "#1d4ed8")
    s.line([(xr, tops[0] + 40), (xr, tops[-1] + 40)], "#2b9348", 3)
    s.line([(xt, tops[0] + 60), (xt, tops[-1] + 60)], "#1d4ed8", 3)
    for k, t in enumerate(tops):
        x0 = 1040
        s.rect(x0, t, 150, 95, fill="#f8f9fa", stroke="#343a40")
        s.text(x0 + 42, t + 22, f"PZEM-004T n°{k + 1}", 12, "start", "bold")
        s.text(x0 + 42, t + 40, f"adresse {k + 1}", 10.5, "start", fill="#0e7c66", weight="bold")
        s.text(x0 + 42, t + 56, f"→ prise {k + 1}", 10.5, "start", fill="#0e7c66", weight="bold")
        s.text(x0 + 42, t + 72, "230 V : autre", 10, "start", fill="#9b2226")
        s.text(x0 + 42, t + 85, "schéma", 10, "start", fill="#9b2226")
        for (dy, lab) in ((20, "5V"), (40, "RX"), (60, "TX"), (80, "GND")):
            s.pin(x0, t + dy, True, "#343a40")
            s.text(x0 + 8, t + dy + 4, lab, 9.5, "start", "bold")
        s.line([(x0, t + 20), (1032, t + 20)], C5V)
        s.flag(1032, t + 20, "5V", "left")
        s.line([(x0, t + 80), (1036, t + 80)], CGND)
        s.flag(1036, t + 80, "GND", "left")
        s.line([(x0, t + 40), (xr, t + 40)], "#2b9348")
        s.dot(xr, t + 40, "#2b9348")
        s.line([(x0, t + 60), (xt, t + 60)], "#1d4ed8")
        s.dot(xt, t + 60, "#1d4ed8")
    s.text(xr - 4, 228, "RX", 10, "end", "bold", "#2b9348")
    s.text(xt + 4, 228, "TX", 10, "start", "bold", "#1d4ed8")

    # ---- alimentation 230 V -> 5 V
    s.rect(480, 790, 240, 95, fill="#ffe8e8", stroke="#9b2226")
    s.text(600, 812, "Alimentation 230 V AC → 5 V DC", 12, "middle", "bold", "#9b2226")
    s.text(600, 830, "HLK-10M05 (5 V 2 A) ou Mean Well HDR-15-5", 10.5, "middle", fill="#52606d")
    s.text(585, 866, "entrée L / N : voir schéma 230 V", 10.5, "middle", fill="#9b2226")
    s.pin(720, 845, True, C5V)
    s.text(712, 849, "+5V", 10, "end", "bold", C5V)
    s.text(712, 874, "−", 12, "end", "bold")
    s.line([(720, 845), (750, 845)], C5V)
    s.flag(750, 845, "5V", "right")
    s.pin(720, 870, True, CGND)
    s.line([(720, 870), (750, 870)], CGND)
    s.flag(750, 870, "GND", "right")

    # ---- légende
    s.rect(820, 700, 360, 255, fill="#f8fafc", stroke="#cbd2d9", rx=10)
    s.text(835, 724, "Légende et règles", 13, weight="bold")
    s.flag(835, 744, "5V", "right")
    s.text(885, 748, "+5 V de l'alimentation (bornier commun)", 11)
    s.flag(835, 772, "3V3", "right")
    s.text(885, 776, "broche 3V3 de l'ESP32", 11)
    s.flag(835, 800, "GND", "right")
    s.text(885, 804, "masse COMMUNE à tous les modules", 11)
    s.dot(845, 826, "#333")
    s.text(885, 830, "point = fils reliés ; croisement sans point = non relié", 11)
    lines = ["Jamais de 5 V sur une broche de l'ESP32 :", "les PZEM passent par le convertisseur.",
             "Programmer l'adresse de chaque PZEM (1 à 4)", "UN À LA FOIS (Réglages > Capteurs PZEM).",
             "Débrancher le 230 V avant de relier l'USB."]
    for i, t in enumerate(lines):
        s.text(835, 856 + 18 * i, t, 11, fill="#7a2e0e" if i in (0, 1, 4) else "#1f2933")
    return s.svg()


# ====================================================================== 230 V
def mains():
    s = Svg(1200, 900, "EnergyLab - câblage 230 V")
    BR, BL, PE = "#8b4513", "#1d4ed8", "#2b9348"
    s.text(30, 38, "EnergyLab — câblage puissance 230 V", 22, weight="bold", fill="#9b2226")
    s.text(30, 62, "DANGER : réservé à une personne qualifiée, boîtier fermé avant toute mise sous tension. Câbler débranché, vérifier au multimètre.", 13, fill="#9b2226", weight="bold")

    def pe_line(pts):
        s.line(pts, PE, 3)
        s.line(pts, "#f2c94c", 3, "6 6")

    # ---- entrée + protection
    s.rect(16, 90, 134, 120, fill="#f1f3f5", stroke="#343a40")
    s.text(83, 112, "Embase IEC C14", 12, "middle", "bold")
    s.text(83, 127, "avec fusible 10 A", 10.5, "middle", fill="#52606d")
    s.text(83, 141, "ou cordon 3G1,5 mm²", 10, "middle", fill="#52606d")
    for (y, lab, col) in ((160, "L", BR), (180, "N", BL), (200, "PE", PE)):
        s.pin(150, y, True, col)
        s.text(142, y + 4, lab, 10.5, "end", "bold", col)
    s.rect(200, 90, 100, 120, fill="#fff", stroke="#343a40")
    s.text(250, 112, "Disjoncteur", 12, "middle", "bold")
    s.text(250, 127, "différentiel", 12, "middle", "bold")
    s.text(250, 143, "2P 10 A 30 mA", 10.5, "middle", fill="#52606d")
    s.text(250, 157, "(type A)", 10.5, "middle", fill="#52606d")
    s.rect(236, 168, 28, 16, fill="#ffd166", stroke="#b08900", rx=3)
    s.text(250, 180, "T", 10, "middle", "bold")
    s.line([(150, 160), (200, 160)], BR)
    s.line([(150, 180), (200, 180)], BL)
    s.pin(200, 160, True, BR)
    s.pin(200, 180, True, BL)
    xN, xL, xPE = 340, 370, 1160
    s.pin(300, 120, True, BR)
    s.pin(300, 140, True, BL)
    s.line([(300, 120), (xL, 120)], BR, 3.5)
    s.line([(300, 140), (xN, 140)], BL, 3.5)
    s.text(xN, 802, "N", 13, "middle", "bold", BL)
    s.text(xL, 802, "L", 13, "middle", "bold", BR)
    s.text(420, 870, "N et L : répartiteurs (barrettes ou bornes à levier type Wago 221)", 10.5, "start", fill="#52606d")
    rows = [300, 440, 580, 720]
    s.line([(xL, 120), (xL, rows[-1] + 45)], BR, 4)
    s.line([(xN, 140), (xN, rows[-1] + 60)], BL, 4)
    s.dot(xL, 120, BR, 5)
    s.dot(xN, 140, BL, 5)
    # terre : de l'embase directement aux prises (jamais par le différentiel)
    pe_line([(150, 200), (170, 200), (170, 820), (xPE, 820), (xPE, rows[0])])
    s.text(660, 838, "terre (vert/jaune) : embase → chaque prise (et boîtier métallique éventuel)", 11, "middle", fill=PE)

    # ---- alimentation 5 V
    s.rect(480, 175, 160, 70, fill="#ffe8e8", stroke="#9b2226")
    s.text(560, 197, "Alimentation 5 V", 12, "middle", "bold")
    s.text(560, 213, "HLK-10M05 / HDR-15-5", 10.5, "middle", fill="#52606d")
    s.text(560, 231, "+5V / GND → basse tension", 10.5, "middle", fill="#0e7c66")
    s.line([(xL, 190), (410, 190)], BR)
    s.dot(xL, 190, BR)
    s.rect(410, 182, 40, 16, fill="#fff", stroke="#343a40", rx=8)
    s.text(430, 177, "F2 T1A", 10, "middle", "bold")
    s.line([(450, 190), (480, 190)], BR)
    s.pin(480, 190, True, BR)
    s.line([(xN, 225), (480, 225)], BL)
    s.dot(xN, 225, BL)
    s.pin(480, 225, True, BL)

    # ---- notes
    s.rect(700, 85, 470, 165, fill="#fff8f0", stroke="#e9c46a", rx=10)
    notes = ["• Seule la PHASE (marron) de chaque prise passe dans le tore.",
             "• Le neutre et la terre ne passent jamais par le relais ni le tore.",
             "• Bornes de tension des PZEM en amont des relais (toujours alimentées).",
             "• Relais : COM ← phase, NO → prise (prise coupée au repos). NC libre.",
             "• Fils : 1,5 mm² pour les prises, 0,75 mm² pour PZEM et alimentation.",
             "• Repérez les bornes L/N et tore sur la sérigraphie de VOTRE PZEM.",
             "• Tester le bouton T du différentiel à chaque séance."]
    for i, t in enumerate(notes):
        s.text(715, 110 + 20 * i, t, 11.5)

    # ---- 4 voies : PZEM + relais + tore + prise
    for k, y in enumerate(rows):
        n = k + 1
        s.text(395, y - 52, f"Voie {n}", 12, weight="bold", fill="#0e7c66")
        # PZEM
        s.rect(470, y - 45, 160, 70, fill="#f8f9fa", stroke="#343a40")
        s.text(550, y - 24, f"PZEM-004T n°{n}", 12, "middle", "bold")
        s.text(550, y - 8, f"adresse {n}", 10.5, "middle", fill="#0e7c66", weight="bold")
        s.text(550, y + 8, "(100 A, tore fourni)", 10, "middle", fill="#52606d")
        s.line([(xL, y - 30), (470, y - 30)], BR)
        s.dot(xL, y - 30, BR)
        s.pin(470, y - 30, True, BR)
        s.text(478, y - 34, "L", 9, "start", "bold", BR)
        s.line([(xN, y - 12), (470, y - 12)], BL)
        s.dot(xN, y - 12, BL)
        s.pin(470, y - 12, True, BL)
        s.text(478, y - 16, "N", 9, "start", "bold", BL)
        # relais
        s.rect(680, y - 28, 130, 50, fill="#e8f4ea", stroke="#2d6a4f", rx=6, dash="5 4")
        s.text(745, y + 38, f"relais K{n} (IN{n})", 10.5, "middle", fill="#2d6a4f", weight="bold")
        s.pin(700, y, True, "#2d6a4f")
        s.text(700, y + 16, "COM", 9, "middle", "bold")
        s.pin(790, y, True, "#2d6a4f")
        s.text(790, y + 16, "NO", 9, "middle", "bold")
        s.pin(790, y - 18, False, "#2d6a4f")
        s.text(806, y - 14, "NC", 9, "start")
        s.line([(700, y), (782, y - 9)], "#2d6a4f", 2.5)
        s.line([(xL, y + 45), (690, y + 45), (690, y), (700, y)], BR)
        s.dot(xL, y + 45, BR)
        # phase vers la prise à travers le tore
        s.line([(790, y), (1000, y)], BR, 3)
        s.add(f'<ellipse cx="890" cy="{y}" rx="11" ry="20" fill="none" stroke="#6c757d" stroke-width="5"/>')
        s.text(890, y + 36, "tore", 10, "middle", "bold", fill="#6c757d")
        s.line([(890, y - 20), (890, y - 36), (630, y - 36)], "#6c757d", 1.8, "4 3")
        s.text(760, y - 40, "fils du tore → bornes CT du PZEM", 9.5, "middle", fill="#6c757d")
        # prise
        s.rect(1000, y - 38, 110, 76, fill="#ffffff", stroke="#343a40", rx=14)
        s.add(f'<circle cx="1040" cy="{y - 4}" r="6" fill="#343a40"/><circle cx="1070" cy="{y - 4}" r="6" fill="#343a40"/>')
        s.text(1055, y + 26, f"Prise {n}", 11, "middle", "bold")
        s.pin(1000, y, True, BR)
        s.line([(xN, y + 60), (1045, y + 60), (1045, y + 38)], BL)
        s.dot(xN, y + 60, BL)
        s.pin(1045, y + 38, True, BL)
        pe_line([(1110, y), (xPE, y)])
        s.dot(xPE, y, PE)
        s.pin(1110, y, True, PE)
    pe_line([(xPE, rows[0]), (xPE, rows[-1])])
    return s.svg()


def main():
    for d in OUT_DIRS:
        os.makedirs(d, exist_ok=True)
        with open(os.path.join(d, "cablage-basse-tension.svg"), "w", encoding="utf-8") as f:
            f.write(low_voltage())
        with open(os.path.join(d, "cablage-230v.svg"), "w", encoding="utf-8") as f:
            f.write(mains())
    print("schémas écrits dans", ", ".join(OUT_DIRS))


if __name__ == "__main__":
    main()
