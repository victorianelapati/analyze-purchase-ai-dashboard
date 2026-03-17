import { useState, useCallback, useEffect } from 'react';
import { Upload, BarChart3, PieChart, LineChart, Search, Loader2, FileText, AlertCircle } from 'lucide-react';
import Papa from 'papaparse';
import { BarChart, Bar, PieChart as RePieChart, Pie, LineChart as ReLineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { cn } from './utils/cn';

type CSVData = Record<string, string | number>[];
type ColumnType = 'categorical' | 'numerical';

interface ChartConfig {
  type: 'bar' | 'pie' | 'line';
  data: Record<string, any>[];
  title: string;
  insight: string;
  xAxisKey?: string;
  yAxisKey?: string;
}

interface ColumnInfo {
  name: string;
  type: ColumnType;
  uniqueValues: string[];
  numericStats?: {
    min: number;
    max: number;
    avg: number;
    median: number;
  };
}

function App() {
  const [csvData, setCsvData] = useState<CSVData>([]);
  const [columns, setColumns] = useState<ColumnInfo[]>([]);
  const [query, setQuery] = useState('');
  const [chartConfig, setChartConfig] = useState<ChartConfig | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recentQueries, setRecentQueries] = useState<string[]>([
    'Show gender distribution',
    'Compare monthly online orders vs monthly store visits',
    'Show shopping preference distribution',
    'Show monthly income distribution',
  ]);
  const [uploadedFileName, setUploadedFileName] = useState<string>('');
  const suggestedQueries = [
    'Show gender distribution',
    'Show shopping preference distribution',
    'Compare monthly online orders vs store visits',
    'Compare avg online spend vs avg store spend',
    'Show monthly income distribution',
    'Show brand loyalty score distribution',
    'Show city tier distribution',
  ];
  const [filteredData, setFilteredData] = useState<CSVData | null>(null);

  // Sample dataset for initial state
  const sampleData = `monthly_income,daily_internet_hours,smartphone_usage_years,social_media_hours,online_payment_trust_score,tech_savvy_score,monthly_online_orders,monthly_store_visits,avg_online_spend,avg_store_spend,discount_sensitivity,return_frequency,avg_delivery_days,delivery_fee_sensitivity,free_return_importance,product_availability_online,impulse_buying_score,need_touch_feel_score,brand_loyalty_score,environmental_awareness,time_pressure_level,gender,city_tier,shopping_preference
45000,3,5,2.5,8,7,4,2,1200,800,0.7,0.2,3,0.6,0.8,0.9,0.5,0.3,0.8,0.7,0.4,Male,1,Online
38000,2,3,1.5,6,5,2,3,800,600,0.8,0.3,4,0.7,0.6,0.7,0.4,0.6,0.6,0.5,0.6,Female,2,Both
52000,4,6,3,9,8,5,1,1500,500,0.6,0.1,2,0.5,0.9,0.95,0.6,0.2,0.9,0.8,0.3,Male,1,Online
42000,3,4,2,7,6,3,2,1000,700,0.75,0.25,3.5,0.65,0.75,0.8,0.55,0.4,0.75,0.65,0.5,Female,3,Offline
48000,5,7,4,8.5,8.5,6,1,1800,400,0.65,0.15,2.5,0.55,0.85,0.85,0.7,0.25,0.85,0.75,0.35,Male,2,Online`;

  useEffect(() => {
    // Load sample data on initial render
    parseCSVData(sampleData, 'sample.csv');
  }, []);

  const parseCSVData = useCallback((csvString: string, fileName: string) => {
    Papa.parse(csvString, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.errors.length > 0) {
          setError('Error parsing CSV: ' + results.errors[0].message);
          return;
        }

        const data = results.data as Record<string, string>[];
        
        // Convert numeric columns to numbers
        const processedData = data.map(row => {
          const processedRow: Record<string, string | number> = {};
          Object.entries(row).forEach(([key, value]) => {
            // Try to convert to number if possible
            const numValue = parseFloat(value);
            processedRow[key] = isNaN(numValue) ? value : numValue;
          });
          return processedRow;
        });

        setCsvData(processedData);
        setUploadedFileName(fileName);
        analyzeColumns(processedData);
        setError(null);
      },
      error: (error: any) => {
        setError('Error reading CSV: ' + error.message);
      }
    });
  }, []);

  const analyzeColumns = (data: CSVData) => {
    if (data.length === 0) return;

    const firstRow = data[0];
    const columnNames = Object.keys(firstRow);
    const columnInfos: ColumnInfo[] = [];

    columnNames.forEach(colName => {
      const values = data.map(row => row[colName]);
      const stringValues = values.map(v => String(v));
      const uniqueValues = Array.from(new Set(stringValues));
      
      // Check if column is numeric
      const numericValues = values.filter(v => typeof v === 'number');
      const isNumeric = numericValues.length > values.length * 0.8; // 80%+ numbers

      if (isNumeric && numericValues.length > 0) {
        const nums = numericValues as number[];
        const sorted = [...nums].sort((a, b) => a - b);
        const median = sorted.length % 2 === 0 
          ? (sorted[sorted.length/2 - 1] + sorted[sorted.length/2]) / 2
          : sorted[Math.floor(sorted.length/2)];
        
        columnInfos.push({
          name: colName,
          type: 'numerical',
          uniqueValues: [],
          numericStats: {
            min: Math.min(...nums),
            max: Math.max(...nums),
            avg: nums.reduce((a, b) => a + b, 0) / nums.length,
            median,
          }
        });
      } else {
        columnInfos.push({
          name: colName,
          type: 'categorical',
          uniqueValues: uniqueValues.slice(0, 20), // Limit for display
        });
      }
    });

    setColumns(columnInfos);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      parseCSVData(text, file.name);
    };
    reader.readAsText(file);
  };

  const processQuery = () => {
    if (!query.trim() || csvData.length === 0) return;

    setIsProcessing(true);
    setError(null);

    // Simulate processing delay
    setTimeout(() => {
      try {
        const result = analyzeData(query, csvData, columns);
        setChartConfig(result);
        
        // Add to recent queries if not already there
        if (!recentQueries.includes(query)) {
          setRecentQueries(prev => [query, ...prev.slice(0, 4)]);
        }
      } catch (err) {
        setError('Error processing query: ' + (err as Error).message);
      } finally {
        setIsProcessing(false);
      }
    }, 500);
  };

  const analyzeData = (query: string, data: CSVData, columns: ColumnInfo[]): ChartConfig => {
    const lowerQuery = query.toLowerCase();
    
    // Find relevant columns based on query
    const relevantColumns = columns.filter(col => 
      lowerQuery.includes(col.name.toLowerCase()) ||
      col.name.toLowerCase().includes(lowerQuery.split(' ').find(word => word.length > 3) || '')
    );

    // If no specific column found, try to match common patterns
    let targetColumn = relevantColumns[0];
    
    if (!targetColumn) {
      // Common patterns
      if (lowerQuery.includes('gender')) {
        targetColumn = columns.find(c => c.name.toLowerCase().includes('gender'))!;
      } else if (lowerQuery.includes('income')) {
        targetColumn = columns.find(c => c.name.toLowerCase().includes('income'))!;
      } else if (lowerQuery.includes('preference')) {
        targetColumn = columns.find(c => c.name.toLowerCase().includes('preference'))!;
      } else if (lowerQuery.includes('distribution')) {
        // Find a categorical column for distribution
        targetColumn = columns.find(c => c.type === 'categorical')!;
      } else if (lowerQuery.includes('compare')) {
        // Find numerical columns for comparison
        targetColumn = columns.find(c => c.type === 'numerical')!;
      }
    }

    if (!targetColumn && columns.length > 0) {
      targetColumn = columns[0]; // Default to first column
    }

    if (!targetColumn) {
      throw new Error('No data available for analysis');
    }

    // Generate chart based on column type and query
    if (targetColumn.type === 'categorical') {
      return generateCategoricalChart(targetColumn.name, data, query);
    } else {
      if (lowerQuery.includes('trend') || lowerQuery.includes('over time')) {
        return generateTrendChart(targetColumn.name, data, query);
      } else if (lowerQuery.includes('compare') && relevantColumns.length >= 2) {
        return generateComparisonChart(relevantColumns.slice(0, 2).map(c => c.name), data, query);
      } else {
        return generateNumericalDistributionChart(targetColumn.name, data, query);
      }
    }
  };

  const generateCategoricalChart = (columnName: string, data: CSVData, _query: string): ChartConfig => {
    const counts: Record<string, number> = {};
    data.forEach(row => {
      const value = String(row[columnName]);
      counts[value] = (counts[value] || 0) + 1;
    });

    const chartData = Object.entries(counts).map(([name, value]) => ({
      name,
      value,
      fill: `hsl(${Math.random() * 360}, 70%, 60%)`,
    }));

    const total = data.length;
    const sortedEntries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    const topCategory = sortedEntries[0]?.[0] || '';
    const topPercent = ((sortedEntries[0]?.[1] || 0) / total * 100).toFixed(1);

    return {
      type: 'pie',
      data: chartData,
      title: `${columnName} Distribution`,
      insight: `The most common ${columnName.toLowerCase()} is "${topCategory}" (${topPercent}%). Data shows ${Object.keys(counts).length} unique categories.`,
    };
  };

  const generateNumericalDistributionChart = (columnName: string, data: CSVData, _query: string): ChartConfig => {
    const values = data.map(row => Number(row[columnName])).filter(v => !isNaN(v));
    
    // Create bins for histogram
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min;
    const binCount = Math.min(10, Math.ceil(values.length / 5));
    const binSize = range / binCount;

    const bins: Record<string, number> = {};
    for (let i = 0; i < binCount; i++) {
      const binStart = min + i * binSize;
      const binEnd = binStart + binSize;
      const binLabel = `${binStart.toFixed(0)}-${binEnd.toFixed(0)}`;
      bins[binLabel] = 0;
    }

    values.forEach(value => {
      const binIndex = Math.floor((value - min) / binSize);
      const binStart = min + binIndex * binSize;
      const binEnd = binStart + binSize;
      const binLabel = `${binStart.toFixed(0)}-${binEnd.toFixed(0)}`;
      bins[binLabel] = (bins[binLabel] || 0) + 1;
    });

    const chartData = Object.entries(bins).map(([name, value]) => ({
      name,
      value,
    }));

    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const median = [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];

    return {
      type: 'bar',
      data: chartData,
      title: `${columnName} Distribution`,
      insight: `Average ${columnName.toLowerCase()}: ${avg.toFixed(2)}. Median: ${median.toFixed(2)}. Range: ${min.toFixed(2)} to ${max.toFixed(2)}.`,
      xAxisKey: 'name',
      yAxisKey: 'value',
    };
  };

  const generateComparisonChart = (columnNames: string[], data: CSVData, _query: string): ChartConfig => {
    const chartData = data.slice(0, 20).map((row, index) => {
      const dataPoint: Record<string, any> = { name: `Record ${index + 1}` };
      columnNames.forEach(col => {
        dataPoint[col] = Number(row[col]) || 0;
      });
      return dataPoint;
    });

    const averages = columnNames.map(col => {
      const values = data.map(row => Number(row[col])).filter(v => !isNaN(v));
      return {
        column: col,
        avg: values.reduce((a, b) => a + b, 0) / values.length,
      };
    });

    const insight = averages.map(a => `${a.column}: ${a.avg.toFixed(2)}`).join(' vs ');

    return {
      type: 'bar',
      data: chartData,
      title: `Comparison: ${columnNames.join(' vs ')}`,
      insight: `Average values: ${insight}.`,
      xAxisKey: 'name',
    };
  };

  const generateTrendChart = (columnName: string, data: CSVData, _query: string): ChartConfig => {
    const sortedData = [...data]
      .map((row, index) => ({ ...row, index }))
      .sort((a, b) => Number((a as Record<string, any>)[columnName]) - Number((b as Record<string, any>)[columnName]));

    const chartData = sortedData.slice(0, 50).map(row => ({
      name: `#${row.index + 1}`,
      value: Number((row as Record<string, any>)[columnName]),
    }));

    const values = chartData.map(d => d.value);
    const trend = values.length > 1 ? values[values.length - 1] - values[0] : 0;

    return {
      type: 'line',
      data: chartData,
      title: `${columnName} Trend`,
      insight: trend > 0 
        ? `Overall increasing trend (+${trend.toFixed(2)} from first to last)`
        : trend < 0
        ? `Overall decreasing trend (${trend.toFixed(2)} from first to last)`
        : `Stable trend observed`,
      xAxisKey: 'name',
      yAxisKey: 'value',
    };
  };

  const handleExampleQuery = (exampleQuery: string) => {
    setQuery(exampleQuery);
  };

  const getExampleDescription = (query: string) => {
    const lower = query.toLowerCase();
    if (lower.includes('gender')) return 'Gender distribution analysis';
    if (lower.includes('income')) return 'Monthly income analysis';
    if (lower.includes('preference')) return 'Shopping preference analysis';
    if (lower.includes('compare')) return 'Comparison between metrics';
    if (lower.includes('distribution')) return 'Category distribution';
    if (lower.includes('online') && lower.includes('store')) return 'Online vs offline comparison';
    return 'Data analysis';
  };

  const renderChart = () => {
    if (!chartConfig) return null;

    const { type, data, xAxisKey, yAxisKey } = chartConfig;

    const colors = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

    switch (type) {
      case 'pie':
        return (
          <ResponsiveContainer width="100%" height={400}>
            <RePieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={(entry) => `${entry.name}: ${entry.value}`}
                outerRadius={150}
                fill="#8884d8"
                dataKey="value"
              >
                {data.map((_entry, index) => (
                  <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </RePieChart>
          </ResponsiveContainer>
        );

      case 'bar':
        return (
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={xAxisKey || 'name'} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey={yAxisKey || 'value'} fill="#8884d8" />
            </BarChart>
          </ResponsiveContainer>
        );

      case 'line':
        return (
          <ResponsiveContainer width="100%" height={400}>
            <ReLineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={xAxisKey || 'name'} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey={yAxisKey || 'value'} stroke="#8884d8" strokeWidth={2} />
            </ReLineChart>
          </ResponsiveContainer>
        );
    }
  };

  return (
    <div className="min-h-screen bg-white p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <header className="mb-10">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 flex items-center gap-4">
            <BarChart3 className="w-10 h-10 text-blue-600" />
            Conversational AI Dashboard
          </h1>
          <p className="text-gray-600 mt-4 text-lg">
            Generate business insights using natural language
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left sidebar - Upload & Info */}
          <div className="space-y-6">
            {/* Upload Card */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Upload className="w-5 h-5" />
                Upload CSV Dataset
              </h2>
              
              <div className="space-y-4">
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-500 transition-colors">
                  <Upload className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-600 mb-2">Drag & drop your CSV file here, or click to browse</p>
                  <input
                    type="file"
                    accept=".csv,.txt"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="file-upload"
                  />
                  <label
                    htmlFor="file-upload"
                    className="inline-block bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 cursor-pointer transition-colors"
                  >
                    Browse Files
                  </label>
                </div>

                {uploadedFileName && (
                  <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 p-3 rounded-lg">
                    <FileText className="w-4 h-4" />
                    <span className="font-medium">Loaded:</span>
                    <span className="truncate">{uploadedFileName}</span>
                  </div>
                )}

                <div className="pt-4 border-t border-gray-200">
                  <p className="text-sm text-gray-500">
                    <strong>Sample dataset loaded:</strong> Customer Behaviour Analytics
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {csvData.length} records, {columns.length} columns
                  </p>
                </div>
              </div>
            </div>

            {/* Dataset Info Card */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Dataset Columns</h2>
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {columns.map((column, index) => (
                  <div key={index} className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-medium text-gray-900">{column.name}</span>
                      <span className={cn(
                        "px-2 py-1 text-xs rounded-full",
                        column.type === 'categorical' 
                          ? "bg-purple-100 text-purple-800"
                          : "bg-green-100 text-green-800"
                      )}>
                        {column.type}
                      </span>
                    </div>
                    {column.type === 'categorical' && column.uniqueValues.length > 0 && (
                      <p className="text-xs text-gray-500 truncate">
                        Values: {column.uniqueValues.slice(0, 3).join(', ')}
                        {column.uniqueValues.length > 3 && '...'}
                      </p>
                    )}
                    {column.type === 'numerical' && column.numericStats && (
                      <div className="text-xs text-gray-500 grid grid-cols-2 gap-1">
                        <span>Avg: {column.numericStats.avg.toFixed(2)}</span>
                        <span>Range: {column.numericStats.min.toFixed(0)}-{column.numericStats.max.toFixed(0)}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Main content - Query & Visualization */}
          <div className="lg:col-span-2 space-y-6">
            {/* Query Card */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Search className="w-5 h-5" />
                Ask About Your Data
              </h2>

              <div className="space-y-4">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && processQuery()}
                    placeholder="e.g., Show gender distribution, Compare monthly income, Analyze shopping preferences..."
                    className="flex-1 border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={csvData.length === 0}
                  />
                  <button
                    onClick={processQuery}
                    disabled={!query.trim() || csvData.length === 0 || isProcessing}
                    className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <BarChart3 className="w-4 h-4" />
                        Analyze
                      </>
                    )}
                  </button>
                </div>

                {error && (
                  <div className="flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-lg">
                    <AlertCircle className="w-4 h-4" />
                    {error}
                  </div>
                )}

                <div>
                  <p className="text-sm text-gray-600 mb-2">Try these examples:</p>
                  <div className="flex flex-wrap gap-2">
                    {suggestedQueries.map((example, index) => (
                      <button
                        key={index}
                        onClick={() => handleExampleQuery(example)}
                        className="text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-full transition-colors"
                      >
                        {example}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Try These Questions Card */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Try These Questions
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {recentQueries.map((example, index) => (
                  <button
                    key={index}
                    onClick={() => handleExampleQuery(example)}
                    className="text-left p-4 bg-gray-50 hover:bg-blue-50 border border-gray-200 hover:border-blue-200 rounded-lg transition-all hover:shadow-sm"
                  >
                    <div className="font-medium text-gray-900">{example}</div>
                    <div className="text-sm text-gray-500 mt-1">
                      {getExampleDescription(example)}
                    </div>
                  </button>
                ))}
              </div>
              <p className="text-sm text-gray-500 mt-4">
                Click any question to analyze your dataset. You can also type your own question above.
              </p>
            </div>

            {/* Visualization Card */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              {chartConfig ? (
                <>
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-semibold text-gray-900">{chartConfig.title}</h2>
                    <div className="flex items-center gap-2">
                      {chartConfig.type === 'pie' && <PieChart className="w-5 h-5 text-purple-600" />}
                      {chartConfig.type === 'bar' && <BarChart3 className="w-5 h-5 text-blue-600" />}
                      {chartConfig.type === 'line' && <LineChart className="w-5 h-5 text-green-600" />}
                      <span className="text-sm font-medium text-gray-600 capitalize">{chartConfig.type} Chart</span>
                    </div>
                  </div>

                  {/* Chart */}
                  <div className="mb-6">
                    {renderChart()}
                  </div>

                  {/* Insight */}
                  <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
                    <h3 className="font-semibold text-blue-900 mb-2">📊 Insight</h3>
                    <p className="text-blue-800">{chartConfig.insight}</p>
                  </div>

                  {/* Raw Data Preview */}
                  <div className="mt-6">
                    <details className="border border-gray-200 rounded-lg">
                      <summary className="px-4 py-3 bg-gray-50 rounded-t-lg cursor-pointer hover:bg-gray-100 font-medium text-gray-700">
                        View Data Used ({chartConfig.data.length} data points)
                      </summary>
                      <div className="p-4 max-h-60 overflow-y-auto">
                        <pre className="text-sm text-gray-600 whitespace-pre-wrap">
                          {JSON.stringify(chartConfig.data.slice(0, 10), null, 2)}
                          {chartConfig.data.length > 10 && `\n... and ${chartConfig.data.length - 10} more`}
                        </pre>
                      </div>
                    </details>
                  </div>
                </>
              ) : (
                <div className="text-center py-12">
                  <BarChart3 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-xl font-medium text-gray-700 mb-2">No Visualization Yet</h3>
                  <p className="text-gray-500">
                    Upload a CSV file and ask a question about your data to generate a visualization.
                  </p>
                </div>
              )}
            </div>

            {/* Stats Card */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Dataset Statistics</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-500">Total Records</p>
                  <p className="text-2xl font-bold text-gray-900">{csvData.length}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-500">Columns</p>
                  <p className="text-2xl font-bold text-gray-900">{columns.length}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-500">Categorical</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {columns.filter(c => c.type === 'categorical').length}
                  </p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-500">Numerical</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {columns.filter(c => c.type === 'numerical').length}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-8 pt-6 border-t border-gray-200 text-center text-gray-500 text-sm">
          <p>Conversational AI Dashboard • Generate business insights using natural language • Powered by React & Recharts</p>
        </footer>
      </div>
    </div>
  );
}

export default App;
