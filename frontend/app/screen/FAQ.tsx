// app/screen/FAQ.tsx
import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  TextInput,
  StatusBar,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";

type FAQItem = {
  question: string;
  answer: string;
  category: string;
};

const faqData: FAQItem[] = [
  // Getting Started
  {
    category: "Getting Started",
    question: "How to add expenses?",
    answer: "Tap the '+' button on the Home screen or navigate to 'Add Record'. Select 'Expenses', enter the amount using the calculator, choose a category (Food, Transport, Housing, etc.), select a payment method (Cash, Bank, or Credit Card), and optionally add a note. Tap 'Save Expenses' to record it.",
  },
  {
    category: "Getting Started",
    question: "How to add income?",
    answer: "Go to 'Add Record' and toggle to 'Income' mode. Enter the amount, select a category (Salary, Investment, Gift, Freelance, or Bonus), choose a payment method, add a date and optional note, then save.",
  },
  {
    category: "Getting Started",
    question: "How to scan receipt?",
    answer: "On the Home screen, tap the camera icon or 'Scan Receipt' button. Take a photo of your receipt or select one from your gallery. The app will automatically extract the amount, date, merchant name, and payment method. Review and confirm the details, then save the record.",
  },
  {
    category: "Getting Started",
    question: "How do I change my currency?",
    answer: "Go to Profile → Account Settings → Currency. Select your preferred currency (MYR, USD, SGD, EUR, GBP, JPY, or CNY). All amounts will be displayed in your chosen currency.",
  },

  // Expenses & Income
  {
    category: "Expenses & Income",
    question: "What categories are available for expenses?",
    answer: "Available expense categories include: Food, Transport, Housing, Shopping, Bills, Entertainment, Healthcare, Education, and Others. Note: Savings should be tracked using the Savings module, not as an expense category.",
  },
  {
    category: "Expenses & Income",
    question: "Can I edit or delete a transaction?",
    answer: "Yes! Navigate to the transaction details by tapping on any expense or income record from the Home screen or the detailed views. You can edit the amount, category, date, payment method, or notes. To delete, use the delete option in the transaction details.",
  },
  {
    category: "Expenses & Income",
    question: "What payment methods can I use?",
    answer: "You can choose from Cash, Bank (includes bank transfers, QR payments like DuitNow, Touch n Go, etc.), or Credit Card. The payment method helps you track how you're spending your money.",
  },
  {
    category: "Expenses & Income",
    question: "Can I add transactions for past dates?",
    answer: "Yes! When adding a record, tap on the date field to open the calendar picker. Select any past date to record historical transactions. This is useful for entering receipts you forgot to record earlier.",
  },

  // Budget Management
  {
    category: "Budget Management",
    question: "How do I set up a budget?",
    answer: "Go to the Budget Allocation screen. Enter your total monthly budget amount. The app will suggest recommended percentages for each category. You can adjust the percentages or amounts for each category. Make sure the total equals 100%. Tap 'Save Budget' to activate it.",
  },
  {
    category: "Budget Management",
    question: "How do I know if I'm over budget?",
    answer: "The app tracks your spending against your budget in real-time. You'll see progress bars and percentages for each category. If you exceed a category budget, you'll receive a notification. The Budget Allocation screen shows your current spending vs. allocated budget for each category.",
  },
  {
    category: "Budget Management",
    question: "Can I set different budgets for different months?",
    answer: "Yes! Use the month navigation arrows in the Budget Allocation screen to switch between months. You can set a unique budget for each month, which is helpful for months with special events or holidays.",
  },
  {
    category: "Budget Management",
    question: "What are the recommended budget percentages?",
    answer: "The app provides industry-standard recommendations: Housing (25-30%), Food (10-15%), Transport (10-15%), Bills (5-10%), Shopping (5-10%), Entertainment (5%), Healthcare (5%), Education (5-10%), and Others (10-15%). Adjust these based on your personal financial situation.",
  },

  // Savings
  {
    category: "Savings",
    question: "How do I track my savings?",
    answer: "Navigate to the Savings screen. You can add savings goals, deposit money into your savings, and track your progress. The Savings module is separate from expenses - don't add 'Savings' as an expense category.",
  },
  {
    category: "Savings",
    question: "Can I set savings goals?",
    answer: "Yes! In the Savings screen, you can create savings goals with target amounts and deadlines. The app will track your progress and show how much you need to save each month to reach your goal.",
  },
  {
    category: "Savings",
    question: "How is savings different from income?",
    answer: "Income is money you earn (salary, freelance, gifts, etc.). Savings is money you set aside from your income. When you save money, it doesn't count as an expense - it's money you're keeping for future use.",
  },

  // Debt Management
  {
    category: "Debt Management",
    question: "How do I add a debt?",
    answer: "Go to the Debt screen and tap 'Add Debt'. Enter the debt name, total amount owed, interest rate (if applicable), minimum payment, and due date. You can track multiple debts and see your total debt at a glance.",
  },
  {
    category: "Debt Management",
    question: "How do I record a debt payment?",
    answer: "In the Debt screen, select a debt and tap 'Make Payment'. Enter the payment amount and date. The app will update your remaining balance and show your progress in paying off the debt.",
  },
  {
    category: "Debt Management",
    question: "Can I track credit card debt?",
    answer: "Yes! Add your credit card as a debt with the current balance. Record payments regularly to track your progress. You can also see how your debt affects your net worth in the financial overview.",
  },

  // Notifications
  {
    category: "Notifications",
    question: "What notifications will I receive?",
    answer: "You'll receive notifications when: you're approaching or exceeding a budget category limit, a debt payment is due soon, you haven't logged expenses in a while, or there are important financial insights available.",
  },
  {
    category: "Notifications",
    question: "How do I manage notification settings?",
    answer: "Go to the Notifications screen to view all your notifications. You can mark them as read, dismiss them, or view details. Budget notifications are automatically created when you set up budgets.",
  },

  // Profile & Settings
  {
    category: "Profile & Settings",
    question: "How do I change my password?",
    answer: "Go to Profile → Account Settings → Password. Enter your current password, then your new password (must be at least 8 characters with uppercase, lowercase, number, and special character). For security, you'll be logged out after changing your password and need to sign in again.",
  },
  {
    category: "Profile & Settings",
    question: "Can I change my username?",
    answer: "Yes! Go to Profile → Account Settings → Username. Tap on it and enter your new username. Your username is displayed on your profile and in the app.",
  },
  {
    category: "Profile & Settings",
    question: "What information is shown in my profile?",
    answer: "Your profile displays your username, email, age, gender, member since date, and financial overview including monthly spending, weekly spending, last transaction, and top spending category.",
  },

  // Receipt Scanning
  {
    category: "Receipt Scanning",
    question: "How accurate is the receipt scanning?",
    answer: "The OCR (Optical Character Recognition) technology extracts information from receipts with high accuracy. However, always review the extracted data before saving, especially for unusual formats or poor image quality.",
  },
  {
    category: "Receipt Scanning",
    question: "What if the receipt scan is incorrect?",
    answer: "You can edit any field after scanning. Review the amount, date, category, merchant name, and payment method. Make corrections as needed before saving the record.",
  },
  {
    category: "Receipt Scanning",
    question: "Can I scan receipts in different languages?",
    answer: "The app supports receipts in multiple languages, though accuracy may vary. For best results, ensure the receipt is clear, well-lit, and the text is readable.",
  },

  // Financial Insights
  {
    category: "Financial Insights",
    question: "What insights does the app provide?",
    answer: "The app analyzes your spending patterns and provides insights such as: spending trends, category breakdowns, savings rate, cash runway, top spending categories, and comparisons with previous months.",
  },
  {
    category: "Financial Insights",
    question: "How does the app calculate my spending behavior?",
    answer: "The app uses AI-powered analysis to examine your transaction history, identify patterns, detect anomalies, and provide personalized recommendations based on your spending habits and financial goals.",
  },

  // Game Feature
  {
    category: "Game Feature",
    question: "What is the game feature?",
    answer: "The app includes a gamified trading game where you can buy and sell items, manage inventory, take loans, save money, and travel between locations. It's a fun way to learn about financial management while tracking your real expenses.",
  },
  {
    category: "Game Feature",
    question: "How do I access the game?",
    answer: "Navigate to the Game section from the main navigation. You can start a new game or load a saved game. The game runs independently from your real financial data but uses similar concepts.",
  },

  // Troubleshooting
  {
    category: "Troubleshooting",
    question: "My data isn't syncing. What should I do?",
    answer: "Ensure you have an active internet connection. The app syncs data in real-time with the cloud. If issues persist, try signing out and signing back in, or contact support.",
  },
  {
    category: "Troubleshooting",
    question: "I forgot my password. How do I reset it?",
    answer: "On the Sign In screen, tap 'Forgot Password'. Enter your email address and follow the instructions sent to your email to reset your password.",
  },
  {
    category: "Troubleshooting",
    question: "How do I export my data?",
    answer: "Currently, your data is stored securely in the cloud. For data export features, please contact support or check future app updates.",
  },
  {
    category: "Troubleshooting",
    question: "The app is running slowly. What can I do?",
    answer: "Try closing and reopening the app. Ensure you have sufficient storage space on your device. If the issue persists, check your internet connection or contact support.",
  },

  // Privacy & Security
  {
    category: "Privacy & Security",
    question: "Is my financial data secure?",
    answer: "Yes! Your data is encrypted and stored securely in the cloud. We use industry-standard security practices to protect your information. Your password is encrypted and never stored in plain text.",
  },
  {
    category: "Privacy & Security",
    question: "Can other people see my financial data?",
    answer: "No. Your financial data is private and only accessible to you when you're signed in to your account. We never share your personal or financial information with third parties.",
  },
];

export default function FAQScreen() {
  const router = useRouter();
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const categories = ["All", ...Array.from(new Set(faqData.map((item) => item.category)))];

  // Get category counts
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    faqData.forEach((item) => {
      counts[item.category] = (counts[item.category] || 0) + 1;
    });
    return counts;
  }, []);

  // Filter FAQs based on category and search
  const filteredFAQs = useMemo(() => {
    let filtered = selectedCategory === "All"
      ? faqData
      : faqData.filter((item) => item.category === selectedCategory);

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(
        (item) =>
          item.question.toLowerCase().includes(query) ||
          item.answer.toLowerCase().includes(query) ||
          item.category.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [selectedCategory, searchQuery]);

  // Group FAQs by category for "All" view
  const groupedFAQs = useMemo(() => {
    if (selectedCategory !== "All" || searchQuery.trim()) {
      return null;
    }
    const groups: Record<string, FAQItem[]> = {};
    faqData.forEach((item) => {
      if (!groups[item.category]) {
        groups[item.category] = [];
      }
      groups[item.category].push(item);
    });
    return groups;
  }, [selectedCategory, searchQuery]);

  const toggleItem = (uniqueKey: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(uniqueKey)) {
      newExpanded.delete(uniqueKey);
    } else {
      newExpanded.add(uniqueKey);
    }
    setExpandedItems(newExpanded);
  };

  const clearSearch = () => {
    setSearchQuery("");
  };

  // Category icons mapping
  const categoryIcons: Record<string, string> = {
    "Getting Started": "rocket-outline",
    "Expenses & Income": "wallet-outline",
    "Budget Management": "pie-chart-outline",
    "Savings": "save-outline",
    "Debt Management": "card-outline",
    "Notifications": "notifications-outline",
    "Profile & Settings": "person-outline",
    "Receipt Scanning": "camera-outline",
    "Financial Insights": "analytics-outline",
    "Game Feature": "game-controller-outline",
    "Troubleshooting": "construct-outline",
    "Privacy & Security": "shield-checkmark-outline",
  };

  // Category colors mapping (subtle tints based on home page colors)
  const categoryColors: Record<string, [string, string]> = {
    "Getting Started": ["#FEF3C7", "#FDE68A"], // Light orange (Food-inspired)
    "Expenses & Income": ["#D1FAE5", "#A7F3D0"], // Light green (Shopping-inspired)
    "Budget Management": ["#DBEAFE", "#BFDBFE"], // Light blue (Bills-inspired)
    "Savings": ["#D1FAE5", "#A7F3D0"], // Light green
    "Debt Management": ["#FEE2E2", "#FECACA"], // Light red (Healthcare-inspired)
    "Notifications": ["#EDE9FE", "#DDD6FE"], // Light purple (Entertainment-inspired)
    "Profile & Settings": ["#E0E7FF", "#C7D2FE"], // Light indigo
    "Receipt Scanning": ["#DBEAFE", "#BFDBFE"], // Light blue
    "Financial Insights": ["#EDE9FE", "#DDD6FE"], // Light purple
    "Game Feature": ["#FEF3C7", "#FDE68A"], // Light orange
    "Troubleshooting": ["#FEE2E2", "#FECACA"], // Light red
    "Privacy & Security": ["#DBEAFE", "#BFDBFE"], // Light blue
  };

  // Popular questions (first 3 from Getting Started)
  const popularQuestions = faqData
    .filter((item) => item.category === "Getting Started")
    .slice(0, 3);

  return (
    <View style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#1E3932" translucent={false} />
      {/* Header with Gradient */}
      <LinearGradient
        colors={["#1E3932", "#2D5A4A"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          styles.headerGradient,
          Platform.OS === "android" && { paddingTop: (StatusBar.currentHeight || 0) + 0 },
        ]}
      >
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
            hitSlop={8}
          >
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.headerSpacer} />
          <View style={styles.headerContent}>
            <View style={styles.headerIconContainer}>
              <Ionicons name="help-circle" size={28} color="#FFFFFF" />
            </View>
            <Text style={styles.headerTitle}>Help Center</Text>
            <Text style={styles.headerSubtitle}>Find answers to common questions</Text>
          </View>
          <View style={styles.headerSpacer} />
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <View style={styles.searchBoxWrapper}>
            <LinearGradient
              colors={["#FFFFFF", "#F9FAFB"]}
              style={styles.searchBox}
            >
              <View style={styles.searchIconContainer}>
                <Ionicons name="search" size={22} color="#1E3932" />
              </View>
              <TextInput
                style={styles.searchInput}
                placeholder="Search questions or topics..."
                placeholderTextColor="#9CA3AF"
                value={searchQuery}
                onChangeText={setSearchQuery}
                returnKeyType="search"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={clearSearch} style={styles.clearButton}>
                  <Ionicons name="close-circle" size={22} color="#9CA3AF" />
                </TouchableOpacity>
              )}
            </LinearGradient>
          </View>
        </View>

        {/* Popular Questions Quick Access */}
        {!searchQuery.trim() && selectedCategory === "All" && (
          <View style={styles.popularSection}>
            <View style={styles.popularHeader}>
              <View style={styles.popularHeaderIconBox}>
                <Ionicons name="flame" size={22} color="#F59E0B" />
              </View>
              <View>
                <Text style={styles.popularTitle}>Popular Questions</Text>
                <Text style={styles.popularSubtitle}>Most asked by users</Text>
              </View>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.popularScrollContent}
            >
              {popularQuestions.map((item, index) => {
                const uniqueKey = `popular-${index}`;
                const isExpanded = expandedItems.has(uniqueKey);
                return (
                  <TouchableOpacity
                    key={uniqueKey}
                    style={styles.popularCard}
                    onPress={() => toggleItem(uniqueKey)}
                    activeOpacity={0.8}
                  >
                    <LinearGradient
                      colors={["#FFFFFF", "#F9FAFB"]}
                      style={styles.popularCardGradient}
                    >
                      <View style={styles.popularCardHeader}>
                        <LinearGradient
                          colors={categoryColors["Getting Started"] || ["#FEF3C7", "#FDE68A"]}
                          style={styles.popularIconBox}
                        >
                          <Ionicons name="help-circle" size={26} color="#1E3932" />
                        </LinearGradient>
                        <View style={styles.popularQuestionContainer}>
                          <Text style={styles.popularQuestionText} numberOfLines={2}>
                            {item.question}
                          </Text>
                          <View style={styles.popularBadge}>
                            <Ionicons name="trending-up" size={12} color="#F59E0B" />
                            <Text style={styles.popularBadgeText}>Popular</Text>
                          </View>
                        </View>
                      </View>
                      <View style={styles.popularAnswerContainer}>
                        {isExpanded && (
                          <ScrollView 
                            style={styles.popularAnswer}
                            contentContainerStyle={styles.popularAnswerContent}
                            nestedScrollEnabled={true}
                            showsVerticalScrollIndicator={false}
                            bounces={false}
                          >
                            <View style={styles.popularAnswerHeader}>
                              <Ionicons name="information-circle" size={16} color="#3B82F6" />
                              <Text style={styles.popularAnswerLabel}>Answer</Text>
                            </View>
                            <Text style={styles.popularAnswerText}>{item.answer}</Text>
                          </ScrollView>
                        )}
                      </View>
                      <View style={styles.popularCardFooter}>
                        <Text style={styles.popularCardFooterText}>
                          {isExpanded ? "Tap to collapse" : "Tap to expand"}
                        </Text>
                        <Ionicons
                          name={isExpanded ? "chevron-up" : "chevron-down"}
                          size={18}
                          color="#1E3932"
                        />
                      </View>
                    </LinearGradient>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Category Filter */}
        <View style={styles.categorySection}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderIconBox}>
              <Ionicons name="grid" size={20} color="#1E3932" />
            </View>
            <View>
              <Text style={styles.sectionLabel}>Browse by Category</Text>
              <Text style={styles.sectionSubtitle}>Select a category to explore</Text>
            </View>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.categoryScroll}
            contentContainerStyle={styles.categoryScrollContent}
          >
            {categories.map((category) => {
              const count = category === "All" ? faqData.length : categoryCounts[category] || 0;
              const iconName = category === "All" ? "apps" : categoryIcons[category] || "folder-outline";
              return (
                <TouchableOpacity
                  key={category}
                  style={[
                    styles.categoryChip,
                    selectedCategory === category && styles.categoryChipActive,
                  ]}
                  onPress={() => {
                    setSelectedCategory(category);
                    setExpandedItems(new Set());
                    setSearchQuery("");
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={iconName as any}
                    size={16}
                    color={selectedCategory === category ? "#FFFFFF" : "#1E3932"}
                    style={styles.categoryIcon}
                  />
                  <Text
                    style={[
                      styles.categoryChipText,
                      selectedCategory === category && styles.categoryChipTextActive,
                    ]}
                  >
                    {category}
                  </Text>
                  {count > 0 && (
                    <View
                      style={[
                        styles.categoryBadge,
                        selectedCategory === category && styles.categoryBadgeActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.categoryBadgeText,
                          selectedCategory === category && styles.categoryBadgeTextActive,
                        ]}
                      >
                        {count}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Results Count */}
        {searchQuery.trim() && (
          <View style={styles.resultsCount}>
            <Text style={styles.resultsCountText}>
              {filteredFAQs.length} {filteredFAQs.length === 1 ? "result" : "results"} found
            </Text>
          </View>
        )}

        {/* FAQ Items - Grouped View for "All" */}
        {groupedFAQs && !searchQuery.trim() ? (
          <View style={styles.faqContainer}>
            {Object.entries(groupedFAQs).map(([category, items]) => (
              <View key={category} style={styles.categoryGroup}>
                <View style={styles.categoryHeader}>
                  <View style={styles.categoryHeaderLeft}>
                    <LinearGradient
                      colors={categoryColors[category] || ["#D1FAE5", "#A7F3D0"]}
                      style={styles.categoryHeaderIconBox}
                    >
                      <Ionicons
                        name={categoryIcons[category] as any || "folder"}
                        size={22}
                        color="#1E3932"
                      />
                    </LinearGradient>
                    <View>
                      <Text style={styles.categoryTitle}>{category}</Text>
                      <View style={styles.categorySubtitleRow}>
                        <Ionicons name="document-text" size={12} color="#9CA3AF" />
                        <Text style={styles.categorySubtitle}>{items.length} questions</Text>
                      </View>
                    </View>
                  </View>
                </View>
                {items.map((item, index) => {
                  const uniqueKey = `${category}-${index}`;
                  const isExpanded = expandedItems.has(uniqueKey);

                  return (
                    <View key={uniqueKey} style={styles.faqItem}>
                      <TouchableOpacity
                        style={styles.faqQuestion}
                        onPress={() => toggleItem(uniqueKey)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.faqQuestionContent}>
                          <LinearGradient
                            colors={categoryColors[item.category] || ["#D1FAE5", "#A7F3D0"]}
                            style={styles.faqIconBox}
                          >
                            <Ionicons
                              name="help-circle"
                              size={22}
                              color="#1E3932"
                            />
                          </LinearGradient>
                          <View style={styles.questionTextContainer}>
                            <Text style={styles.faqQuestionText} numberOfLines={2}>
                              {item.question}
                            </Text>
                          </View>
                        </View>
                        <View style={styles.chevronContainer}>
                          <Ionicons
                            name={isExpanded ? "chevron-up" : "chevron-down"}
                            size={22}
                            color="#1E3932"
                          />
                        </View>
                      </TouchableOpacity>

                      {isExpanded && (
                        <View style={styles.faqAnswer}>
                          <View style={styles.faqAnswerContent}>
                            <LinearGradient
                              colors={["#DBEAFE", "#BFDBFE"]}
                              style={styles.faqAnswerIconBox}
                            >
                              <Ionicons name="checkmark-circle" size={20} color="#2563EB" />
                            </LinearGradient>
                            <Text style={styles.faqAnswerText}>{item.answer}</Text>
                          </View>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            ))}
          </View>
        ) : filteredFAQs.length > 0 ? (
          /* FAQ Items - List View */
          <View style={styles.faqContainer}>
            {filteredFAQs.map((item, index) => {
              const uniqueKey = `${selectedCategory}-${index}-${item.question}`;
              const isExpanded = expandedItems.has(uniqueKey);

              return (
                <View key={uniqueKey} style={styles.faqItem}>
                  <TouchableOpacity
                    style={styles.faqQuestion}
                    onPress={() => toggleItem(uniqueKey)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.faqQuestionContent}>
                      <LinearGradient
                        colors={categoryColors[item.category] || ["#D1FAE5", "#A7F3D0"]}
                        style={styles.faqIconBox}
                      >
                        <Ionicons
                          name="help-circle"
                          size={22}
                          color="#1E3932"
                        />
                      </LinearGradient>
                      <View style={styles.questionTextContainer}>
                        <Text style={styles.faqQuestionText} numberOfLines={2}>
                          {item.question}
                        </Text>
                        {selectedCategory === "All" && (
                          <View style={styles.categoryTagContainer}>
                            <Ionicons
                              name={categoryIcons[item.category] as any || "folder"}
                              size={12}
                              color="#6B7280"
                            />
                            <Text style={styles.faqCategoryTag}>{item.category}</Text>
                          </View>
                        )}
                      </View>
                    </View>
                    <View style={styles.chevronContainer}>
                      <Ionicons
                        name={isExpanded ? "chevron-up" : "chevron-down"}
                        size={22}
                        color="#1E3932"
                      />
                    </View>
                  </TouchableOpacity>

                  {isExpanded && (
                    <View style={styles.faqAnswer}>
                      <View style={styles.faqAnswerContent}>
                        <LinearGradient
                          colors={["#DBEAFE", "#BFDBFE"]}
                          style={styles.faqAnswerIconBox}
                        >
                          <Ionicons name="checkmark-circle" size={20} color="#2563EB" />
                        </LinearGradient>
                        <Text style={styles.faqAnswerText}>{item.answer}</Text>
                      </View>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        ) : (
          /* Empty State */
          <View style={styles.emptyState}>
            <Ionicons name="search-outline" size={64} color="#D1D5DB" />
            <Text style={styles.emptyStateTitle}>No results found</Text>
            <Text style={styles.emptyStateText}>
              Try adjusting your search or browse by category
            </Text>
            <TouchableOpacity
              style={styles.emptyStateButton}
              onPress={() => {
                setSearchQuery("");
                setSelectedCategory("All");
              }}
            >
              <Text style={styles.emptyStateButtonText}>Clear Search</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Help Section */}
        <LinearGradient
          colors={["#1E3932", "#2D5A4A"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.helpSection}
        >
          <View style={styles.helpCard}>
            <View style={styles.helpIconContainer}>
              <Ionicons name="mail" size={36} color="#FFFFFF" />
            </View>
            <Text style={styles.helpTitle}>Still need help?</Text>
            <Text style={styles.helpText}>
              If you can&apos;t find the answer you&apos;re looking for, please contact our support team.
            </Text>
          </View>
        </LinearGradient>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#E4F2ED",
  },
  headerGradient: {
    paddingTop: Platform.OS === "ios" ? 50 : 0,
    paddingBottom: 8,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
  },
  headerSpacer: {
    width: 40,
  },
  headerContent: {
    flex: 1,
    alignItems: "center",
  },
  headerIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "900",
    color: "#FFFFFF",
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.9)",
    fontWeight: "500",
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
  },
  searchBoxWrapper: {
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "#C9EAD6",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#D1FAE5",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: "#1E3932",
    fontWeight: "500",
    padding: 0,
  },
  clearButton: {
    marginLeft: 8,
    padding: 4,
  },
  categorySection: {
    paddingBottom: 12,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  sectionHeaderIconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "#D1FAE5",
    justifyContent: "center",
    alignItems: "center",
  },
  sectionLabel: {
    fontSize: 17,
    fontWeight: "800",
    color: "#1E3932",
    letterSpacing: -0.3,
    marginBottom: 2,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: "#6B7280",
    fontWeight: "500",
  },
  popularSection: {
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  popularHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  popularHeaderIconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "#FEF3C7",
    justifyContent: "center",
    alignItems: "center",
  },
  popularTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#1E3932",
    letterSpacing: -0.3,
    marginBottom: 2,
  },
  popularSubtitle: {
    fontSize: 12,
    color: "#6B7280",
    fontWeight: "500",
  },
  popularScrollContent: {
    gap: 10,
    paddingRight: 16,
  },
  popularCard: {
    width: 280,
    minHeight: 160,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "#C9EAD6",
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: "#1E3932",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 12,
      },
      android: {
        elevation: 5,
      },
    }),
  },
  popularCardGradient: {
    padding: 16,
    flexDirection: "column",
    minHeight: 160,
  },
  popularCardHeader: {
    flexDirection: "row",
    marginBottom: 12,
    gap: 12,
    flexShrink: 0,
    flexGrow: 0,
  },
  popularIconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  popularQuestionContainer: {
    flex: 1,
  },
  popularQuestionText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1E3932",
    lineHeight: 22,
    marginBottom: 8,
  },
  popularBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  popularBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#D97706",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  popularAnswerContainer: {
    marginTop: 10,
  },
  popularAnswer: {
    maxHeight: 200,
    borderTopWidth: 1.5,
    borderTopColor: "#E5E7EB",
  },
  popularAnswerContent: {
    paddingTop: 12,
    paddingBottom: 8,
  },
  popularAnswerHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  popularAnswerLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#3B82F6",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  popularAnswerText: {
    fontSize: 13,
    color: "#374151",
    lineHeight: 20,
    fontWeight: "500",
  },
  popularCardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
    marginTop: 10,
    paddingTop: 10,
    flexShrink: 0,
  },
  popularCardFooterText: {
    fontSize: 11,
    color: "#6B7280",
    fontWeight: "600",
  },
  categoryScroll: {
    marginBottom: 8,
  },
  categoryScrollContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  resultsCount: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  resultsCountText: {
    fontSize: 13,
    color: "#6B7280",
    fontWeight: "600",
  },
  categoryChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    borderWidth: 2,
    borderColor: "#E5E7EB",
    gap: 10,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  categoryChipActive: {
    backgroundColor: "#1E3932",
    borderColor: "#1E3932",
    ...Platform.select({
      ios: {
        shadowColor: "#1E3932",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  categoryIcon: {
    marginRight: 0,
  },
  categoryChipText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#6B7280",
  },
  categoryChipTextActive: {
    color: "#FFFFFF",
  },
  categoryBadge: {
    backgroundColor: "#F3F4F6",
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 24,
    alignItems: "center",
  },
  categoryBadgeActive: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
  },
  categoryBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#6B7280",
  },
  categoryBadgeTextActive: {
    color: "#FFFFFF",
  },
  faqContainer: {
    paddingHorizontal: 16,
    gap: 12,
  },
  categoryGroup: {
    marginBottom: 4,
  },
  categoryHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  categoryHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  categoryHeaderIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  categoryTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1E3932",
    letterSpacing: -0.3,
    marginBottom: 2,
  },
  categorySubtitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  categorySubtitle: {
    fontSize: 13,
    color: "#9CA3AF",
    fontWeight: "600",
  },
  faqItem: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: "#C9EAD6",
    marginBottom: 12,
    ...Platform.select({
      ios: {
        shadowColor: "#1E3932",
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  faqQuestion: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    minHeight: 64,
  },
  faqQuestionContent: {
    flexDirection: "row",
    alignItems: "flex-start",
    flex: 1,
    marginRight: 12,
    minWidth: 0,
  },
  faqIconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    flexShrink: 0,
  },
  chevronContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#D1FAE5",
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  questionTextContainer: {
    flex: 1,
  },
  faqQuestionText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1E3932",
    lineHeight: 22,
    marginBottom: 4,
  },
  categoryTagContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  faqCategoryTag: {
    fontSize: 11,
    color: "#6B7280",
    fontWeight: "600",
  },
  faqAnswer: {
    borderTopWidth: 1.5,
    borderTopColor: "#C9EAD6",
    padding: 16,
    backgroundColor: "#F5F9F8",
  },
  faqAnswerContent: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  faqAnswerIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    marginTop: 2,
    flexShrink: 0,
  },
  faqAnswerText: {
    flex: 1,
    fontSize: 14,
    color: "#374151",
    lineHeight: 22,
    fontWeight: "500",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#1E3932",
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
  },
  emptyStateButton: {
    backgroundColor: "#1E3932",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  emptyStateButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  helpSection: {
    marginTop: 16,
    marginHorizontal: -16,
    paddingHorizontal: 16,
    paddingTop: 24,
    marginBottom: -80,
  },
  helpCard: {
    padding: 24,
    alignItems: "center",
  },
  helpIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  helpTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#FFFFFF",
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  helpText: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.95)",
    textAlign: "center",
    lineHeight: 20,
    fontWeight: "500",
  },
});
