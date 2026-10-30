import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

export const GraduationTrendChart = ({ items }: {
  items: { label: string; grads: number; employed: number; rate: number }[];
}) => (
  <ResponsiveContainer width="100%" height="100%">
    <BarChart data={items}>
      <CartesianGrid strokeDasharray="3 3" />
      <XAxis dataKey="label" />
      <YAxis />
      <Tooltip />
      <Legend />
      <Bar dataKey="grads" name="졸업생" fill="#8884d8" />
      <Bar dataKey="employed" name="취업" fill="#82ca9d" />
    </BarChart>
  </ResponsiveContainer>
);

export const StudentDistributionCharts = ({ gradeData, stateData }: {
  gradeData: { grade: string; count: number }[];
  stateData: { state: string; count: number }[];
}) => {
  const colors = ['#8884d8', '#82ca9d', '#ffc658', '#ff7f50', '#a4de6c'];
  return (
    <>
      <div style={{ height: 160 }}>
        <div style={{ fontSize: 12, marginBottom: 4 }}>학년 분포</div>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={gradeData} dataKey="count" nameKey="grade" outerRadius={60} label>
              {gradeData.map((entry, index) => (
                <Cell key={entry.grade} fill={colors[index % colors.length]} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div style={{ height: 160 }}>
        <div style={{ fontSize: 12, marginBottom: 4 }}>상태 분포</div>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={stateData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="state" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="count" fill="#82ca9d" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </>
  );
};

export const AccountingPieChart = ({ data }: {
  data: { category: string; amount: number }[];
}) => {
  const colors = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#AF19FF', '#FF1919'];
  return (
    <ResponsiveContainer width="100%" height="100%" minHeight={300}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
          outerRadius={80}
          fill="#8884d8"
          dataKey="amount"
          nameKey="category"
        >
          {data.map((entry, index) => (
            <Cell key={`${entry.category}-${index}`} fill={colors[index % colors.length]} />
          ))}
        </Pie>
        <Tooltip formatter={(value: number) => `${value.toLocaleString()}원`} />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
};

export const IncomeExpenseBarChart = ({ data }: {
  data: { category: string; income: number; expense: number }[];
}) => (
  <ResponsiveContainer width="100%" height="100%" minHeight={220}>
    <BarChart
      data={data.map(item => ({ name: item.category, 수입: item.income, 지출: item.expense }))}
      margin={{ top: 5, right: 10, left: 0, bottom: 40 }}
      barCategoryGap="20%"
      barGap={4}
    >
      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
      <XAxis dataKey="name" angle={-45} textAnchor="end" height={60} tick={{ fontSize: 9 }} interval={0} width={60} />
      <YAxis
        tick={{ fontSize: 9 }}
        width={45}
        tickFormatter={(value) => {
          if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
          if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
          return value.toString();
        }}
      />
      <Tooltip
        formatter={(value: number) => `${value.toLocaleString()}원`}
        contentStyle={{ fontSize: '10px', padding: '5px 6px', borderRadius: '4px', border: '1px solid #e5e7eb' }}
      />
      <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '6px' }} iconSize={8} />
      <Bar dataKey="수입" fill="#10b981" radius={[3, 3, 0, 0]} />
      <Bar dataKey="지출" fill="#ef4444" radius={[3, 3, 0, 0]} />
    </BarChart>
  </ResponsiveContainer>
);
