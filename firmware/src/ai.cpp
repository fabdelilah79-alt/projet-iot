// EnergyLab - fonctions intelligentes (voir ai.h). Identique à web/src/32_ai.js
#include "ai.h"

#include <algorithm>

namespace ai {

void FastHistory::push(const Sample& s) {
  buf_[head_] = s;
  head_ = (head_ + 1) % FAST_N;
  if (count_ < FAST_N) count_++;
}

const Sample& FastHistory::at(int i) const {
  int idx = head_ - 1 - i;
  while (idx < 0) idx += FAST_N;
  return buf_[idx % FAST_N];
}

double FastHistory::total(int i) const {
  const Sample& s = at(i);
  double t = 0;
  for (int k = 0; k < NOUT; k++) t += s.p[k];
  return t;
}

static int clampN(int n, int lo, int hi) { return n < lo ? lo : (n > hi ? hi : n); }

double FastHistory::avgP(int o, int n) const {
  if (count_ == 0 || o < 0 || o >= NOUT) return NAN;
  n = clampN(n, 1, count_);
  double s = 0;
  for (int i = 0; i < n; i++) s += at(i).p[o];
  return s / n;
}

double FastHistory::avgTotal(int n) const {
  if (count_ == 0) return NAN;
  n = clampN(n, 1, count_);
  double s = 0;
  for (int i = 0; i < n; i++) s += total(i);
  return s / n;
}

double FastHistory::maxTotal(int n) const {
  if (count_ == 0) return NAN;
  n = clampN(n, 1, count_);
  double m = total(0);
  for (int i = 1; i < n; i++) {
    double v = total(i);
    if (v > m) m = v;
  }
  return m;
}

// Pente (W/min) de la droite des moindres carrés sur les n dernières secondes
double FastHistory::slopeTotalPerMin(int n) const {
  if (count_ < 2) return 0;
  n = clampN(n, 2, count_);
  double sx = 0, sy = 0;
  for (int i = 0; i < n; i++) {
    sx += -i;
    sy += total(i);
  }
  double mx = sx / n, my = sy / n;
  double num = 0, den = 0;
  for (int i = 0; i < n; i++) {
    double dx = -i - mx;
    num += dx * (total(i) - my);
    den += dx * dx;
  }
  if (den == 0) return 0;
  return num / den * 60.0;
}

void Holt::addSecond(double total) {
  if (isnan(total)) return;
  acc_ += total;
  n_++;
  if (n_ < 10) return;
  double y = acc_ / n_;
  acc_ = 0;
  n_ = 0;
  const double alpha = 0.3, beta = 0.1;
  if (!init_) {
    L_ = y;
    T_ = 0;
    init_ = true;
    return;
  }
  double prev = L_;
  L_ = alpha * y + (1 - alpha) * (L_ + T_);
  T_ = beta * (L_ - prev) + (1 - beta) * T_;
}

double Holt::forecast(double minutes) const {
  if (!init_) return NAN;
  if (!(minutes >= 0)) minutes = 0;
  if (minutes > 120) minutes = 120;
  double v = L_ + T_ * (minutes * 6.0);
  return v < 0 ? 0 : v;
}

void Anomaly::update(double p, double zThr) {
  if (isnan(p)) return;
  if (!init_) {
    init_ = true;
    mu_ = p;
    var_ = 0;
    over_ = 0;
    flag_ = false;
    z_ = 0;
    return;
  }
  double sd = sqrt(var_);
  double floorSd = 2.0 + 0.05 * fabs(mu_);
  double den = sd > floorSd ? sd : floorSd;
  z_ = fabs(p - mu_) / den;
  if (z_ > zThr && p > 5.0) over_++;
  else over_ = 0;
  flag_ = over_ >= 3;
  if (over_ >= 60) {
    // le nouveau régime devient la référence
    mu_ = p;
    var_ = 0;
    over_ = 0;
    flag_ = false;
    return;
  }
  if (over_ == 0) {
    const double a = 0.05;
    double d = p - mu_;
    mu_ += a * d;
    var_ = (1 - a) * (var_ + a * d * d);
  }
}

double Knn::distance(double p1, double pf1, double p2, double pf2) {
  double x1 = log10(p1 > 0.1 ? p1 : 0.1);
  double x2 = log10(p2 > 0.1 ? p2 : 0.1);
  double dx = (x1 - x2) / 0.12;
  double dy = (pf1 - pf2) / 0.08;
  return sqrt(dx * dx + dy * dy);
}

int Knn::classify(double p, double pf, int k, double maxDist, double* nearestDist) const {
  if (nearestDist) *nearestDist = NAN;
  if (isnan(p) || p < 1.0) return 0;
  if (samples.empty()) return -1;
  if (k < 1) k = 1;
  struct DL { double d; int label; };
  std::vector<DL> v;
  v.reserve(samples.size());
  for (size_t i = 0; i < samples.size(); i++) {
    v.push_back({distance(p, pf, samples[i].p, samples[i].pf), samples[i].label});
  }
  // tri stable par distance (en cas d'égalité, l'ordre d'apprentissage départage)
  std::stable_sort(v.begin(), v.end(), [](const DL& a, const DL& b) { return a.d < b.d; });
  if (nearestDist) *nearestDist = v[0].d;
  if (v[0].d > maxDist) return -1;
  int n = k < (int)v.size() ? k : (int)v.size();
  int best = v[0].label;
  int bestCount = 0;
  for (int i = 0; i < n; i++) {
    int c = 0;
    for (int j = 0; j < n; j++)
      if (v[j].label == v[i].label) c++;
    // à égalité de votes, le premier rencontré (le plus proche) l'emporte
    if (c > bestCount) {
      bestCount = c;
      best = v[i].label;
    }
  }
  return best;
}

int Knn::labelId(const std::string& name, bool create) {
  for (size_t i = 0; i < labels.size(); i++)
    if (labels[i].name == name) return labels[i].id;
  if (!create || (int)labels.size() >= MAX_LABELS) return -1;
  int id = 1;
  bool used = true;
  while (used) {
    used = false;
    for (size_t i = 0; i < labels.size(); i++)
      if (labels[i].id == id) { used = true; id++; break; }
  }
  labels.push_back({id, name});
  return id;
}

const char* Knn::labelName(int id) const {
  for (size_t i = 0; i < labels.size(); i++)
    if (labels[i].id == id) return labels[i].name.c_str();
  return "";
}

void Knn::removeLabel(int id) {
  for (size_t i = 0; i < labels.size(); i++) {
    if (labels[i].id == id) {
      labels.erase(labels.begin() + i);
      break;
    }
  }
  std::vector<KnnSample> keep;
  for (size_t i = 0; i < samples.size(); i++)
    if (samples[i].label != id) keep.push_back(samples[i]);
  samples.swap(keep);
}

}  // namespace ai
