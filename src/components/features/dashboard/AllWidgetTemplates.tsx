import React from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

/**
 * 과제 목록을 표시하는 위젯 컴포넌트입니다.
 * @param {object} props - 컴포넌트 props
 * @param {{ name: string; due: string }[]} props.items - 과제 항목 배열 (이름, 마감일 포함)
 */
export const AssignmentListComponent = ({ items }: { items: { name: string; due: string }[] }) => (
    <div className="widget-content">
        {items.map((item, index) => (
            <div key={index} className="assignment-item" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span><i className="fas fa-book" style={{ marginRight: "8px" }}></i>{item.name}</span>
                <span className={`assignment-due ${item.due === '제출 완료' ? 'completed' : ''}`}>{item.due}</span>
            </div>
        ))}
    </div>
);

/**
 * 버스 목록을 표시하는 위젯 컴포넌트입니다.
 * @param {object} props - 컴포넌트 props
 * @param {{ route: string; time: string }[]} props.items - 버스 항목 배열 (노선, 시간 포함)
 */
export const BusListComponent = ({ items }: { items: { route: string; time: string }[] }) => (
    <div className="widget-content">
        {items.map((item, index) => (
            <div key={index} className="bus-item" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span><i className="fas fa-bus" style={{ marginRight: "8px" }}></i>{item.route}</span>
                <span className="bus-time">{item.time}</span>
            </div>
        ))}
    </div>
);

/**
 * 캠퍼스 맵을 표시하는 위젯 컴포넌트입니다.
 * @param {object} props - 컴포넌트 props
 * @param {string} props.message - 맵 관련 메시지
 * @param {string} props.image - 맵 이미지 (예: SVG 문자열 또는 이미지 URL)
 */
export const CampusMapWidget = ({ message, image }: { message: string, image: string }) => {
  return (
    <div className="widget-content">
      <p>{message}</p>
      <div className="map-container">
        {image}
      </div>
    </div>
  );
};

/**
 * 기본 메시지를 표시하는 위젯 컴포넌트입니다.
 * @param {object} props - 컴포넌트 props
 * @param {string} props.message - 표시할 메시지
 */
export const DefaultMessage = ({ message, onButtonClick }: { message: string, onButtonClick?: () => void }) => (
    <div className="widget-content">
        <p>{message}</p>
        {onButtonClick && (
          <button
              onClick={onButtonClick}
              style={{
                  marginTop: '10px',
                  padding: '8px 12px',
                  backgroundColor: '#1a1a1a',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  width: '100%',
                  fontSize: '14px'
              }}
          >
              장부 선택
          </button>
        )}
    </div>
);

// 졸업 요약 위젯
export const GraduationSummaryWidget = ({
  latestYear,
  latestTerm,
  totalGrads,
  advanced,
  employed,
}: {
  latestYear?: string;
  latestTerm?: string;
  totalGrads?: number;
  advanced?: number;
  employed?: number;
}) => {
  if (!latestYear) {
    return (
      <div className="widget-content">
        <p>졸업 데이터가 없습니다.</p>
      </div>
    );
  }
  const total = totalGrads ?? 0;
  const adv = advanced ?? 0;
  const employable = total - adv;
  return (
    <div className="widget-content">
      <div style={{ fontSize: 13, color: '#666', marginBottom: 8 }}>
        {latestYear}년 {latestTerm || ''} 졸업
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div>
          <div style={{ fontSize: 12, color: '#888' }}>졸업생</div>
          <div style={{ fontSize: 20, fontWeight: 600 }}>{total}</div>
        </div>
        <div>
          <div style={{ fontSize: 12, color: '#888' }}>진학</div>
          <div style={{ fontSize: 20, fontWeight: 600 }}>{adv}</div>
        </div>
        <div>
          <div style={{ fontSize: 12, color: '#888' }}>취업 대상(졸업-진학)</div>
          <div style={{ fontSize: 18, fontWeight: 600 }}>{employable}</div>
        </div>
        <div>
          <div style={{ fontSize: 12, color: '#888' }}>취업 (추후 연동)</div>
          <div style={{ fontSize: 18, fontWeight: 600 }}>{employed ?? 0}</div>
        </div>
      </div>
    </div>
  );
};

// 취업률 카드 위젯 (분모는 졸업-진학, 취업자 수는 추후 취업관리 연동)
export const EmploymentRateWidget = ({
  latestYear,
  latestTerm,
  employmentRate,
  employable,
}: {
  latestYear?: string;
  latestTerm?: string;
  employmentRate?: number;
  employable?: number;
}) => {
  if (!latestYear) {
    return (
      <div className="widget-content">
        <p>취업률을 계산할 졸업 회차가 없습니다.</p>
      </div>
    );
  }
  const rate = employmentRate ?? 0;
  return (
    <div className="widget-content">
      <div style={{ fontSize: 13, color: '#666', marginBottom: 8 }}>
        {latestYear}년 {latestTerm || ''} 취업률
      </div>
      <div style={{ fontSize: 32, fontWeight: 700, marginBottom: 4 }}>
        {rate}%
      </div>
      <div style={{ fontSize: 12, color: '#888' }}>
        분모: 졸업생 - 진학 ({employable ?? 0}명 기준)
      </div>
      <div style={{ fontSize: 11, color: '#aaa', marginTop: 4 }}>
        ※ 실제 취업자 수는 취업관리 테이블 연동 후 반영
      </div>
    </div>
  );
};

// 졸업 회차별 트렌드 차트
export const GraduationTrendWidget = ({
  items,
}: {
  items: { label: string; grads: number; employed: number; rate: number }[];
}) => {
  if (!items || items.length === 0) {
    return (
      <div className="widget-content">
        <p>트렌드 데이터가 없습니다.</p>
      </div>
    );
  }
  return (
    <div className="widget-content" style={{ height: 220 }}>
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
    </div>
  );
};

// 위험군/관리 필요 학생 리스트
export const StudentRiskWidget = ({
  items,
}: {
  items: { no: string; name: string; grade: string; state: string; flunk?: string }[];
}) => (
  <div className="widget-content">
    {(!items || items.length === 0) ? (
      <p>현재 표시할 관리 필요 학생이 없습니다.</p>
    ) : (
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {items.map((s) => (
          <li key={s.no} style={{ padding: '4px 0', borderBottom: '1px solid #f1f5f9' }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>
              {s.name} ({s.no})
            </div>
            <div style={{ fontSize: 12, color: '#666' }}>
              {s.grade}학년 · {s.state} {s.flunk && s.flunk.toString().trim() ? '· 유급' : ''}
            </div>
          </li>
        ))}
      </ul>
    )}
  </div>
);

// 학년·상태 분포 차트
export const StudentDistributionWidget = ({
  gradeData,
  stateData,
}: {
  gradeData: { grade: string; count: number }[];
  stateData: { state: string; count: number }[];
}) => {
  const colors = ['#8884d8', '#82ca9d', '#ffc658', '#ff7f50', '#a4de6c'];

  return (
    <div className="widget-content" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
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
    </div>
  );
};

/**
 * 이벤트 목록을 표시하는 위젯 컴포넌트입니다.
 * @param {object} props - 컴포넌트 props
 * @param {{ date: string; event: string }[]} props.items - 이벤트 항목 배열 (날짜, 이벤트 내용 포함)
 */
export const EventListComponent = ({ items, onItemClick }: { items: { date: string; event: string }[], onItemClick?: () => void }) => (
    <div className="widget-content" style={{ padding: '6px 0' }}>
        {items.map((item, index) => (
            <div 
                key={index} 
                onClick={onItemClick}
                style={{ 
                    marginBottom: index < items.length - 1 ? '6px' : '0',
                    cursor: onItemClick ? 'pointer' : 'default',
                    padding: '6px 8px',
                    borderRadius: '4px',
                    transition: 'background-color 0.2s',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px',
                    fontSize: '13px'
                }}
                onMouseEnter={(e) => {
                    if (onItemClick) {
                        e.currentTarget.style.backgroundColor = '#f8fafc';
                    }
                }}
                onMouseLeave={(e) => {
                    if (onItemClick) {
                        e.currentTarget.style.backgroundColor = 'transparent';
                    }
                }}
            >
                <span 
                    className="calendar-day" 
                    style={{ 
                        minWidth: '75px', 
                        fontSize: '11px', 
                        fontWeight: '600', 
                        color: '#888',
                        letterSpacing: '0.3px',
                        textTransform: 'uppercase',
                        paddingTop: '2px'
                    }}
                >
                    {item.date}
                </span>
                <span 
                    className="calendar-event" 
                    style={{ 
                        flex: 1, 
                        fontSize: '13px',
                        color: '#1a1a1a',
                        lineHeight: '1.5'
                    }}
                >
                    {item.event}
                </span>
            </div>
        ))}
    </div>
);

/**
 * 성적 목록을 표시하는 위젯 컴포넌트입니다.
 * @param {object} props - 컴포넌트 props
 * @param {{ subject: string; grade: string; progress: number }[]} props.items - 성적 항목 배열 (과목, 성적, 진행률 포함)
 */
export const GradeListComponent = ({ items }: { items: { subject: string; grade: string; progress: number }[] }) => (
    <div className="widget-content">
        {items.map((item, index) => (
            <React.Fragment key={index}>
                <div className="grade-item" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span><i className="fas fa-book" style={{ marginRight: "8px" }}></i>{item.subject}</span>
                    <span>{item.grade}</span>
                </div>
                <div className="grade-bar" style={{ height: '6px', backgroundColor: '#eee', borderRadius: '3px', marginBottom: '8px' }}>
                    <div className="grade-progress" style={{ width: `${item.progress}%`, height: '100%', backgroundColor: '#4caf50', borderRadius: '3px' }}></div>
                </div>
            </React.Fragment>
        ))}
    </div>
);

/**
 * 아이콘과 텍스트 목록을 표시하는 위젯 컴포넌트입니다.
 * @param {object} props - 컴포넌트 props
 * @param {{ icon: string; text: string }[]} props.items - 아이콘 및 텍스트 항목 배열
 */
export const IconListComponent = ({ items }: { items: { icon: string; text: string }[] }) => (
  <div className="widget-content">
    {items.map((item, index) => (
      <p key={index}>
        <i className={item.icon} style={{ marginRight: "8px" }}></i> {item.text}
      </p>
    ))}
  </div>
);

/**
 * 키-값 쌍 목록을 표시하는 위젯 컴포넌트입니다.
 * @param {object} props - 컴포넌트 props
 * @param {{ icon: string; key: string; value: string; total: string }[]} props.items - 키-값 항목 배열 (아이콘, 키, 값, 총계 포함)
 */
export const KeyValueListComponent = ({ items }: { items: { icon: string; key: string; value: string; total: string }[] }) => (
  <div className="widget-content">
    {items.map((item, index) => (
      <p key={index} style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span><i className={item.icon} style={{ marginRight: "8px" }}></i> {item.key}</span>
        <span>
            <span className="seat-available" style={{ fontWeight: "bold" }}>{item.value}</span>
            <span className="seat-total">/ {item.total}</span>
        </span>
      </p>
    ))}
  </div>
);

/**
 * 일반 텍스트 목록을 표시하는 위젯 컴포넌트입니다.
 * @param {object} props - 컴포넌트 props
 * @param {string[]} props.items - 텍스트 항목 배열
 */
export const ListComponent = ({ items, onButtonClick, spreadsheetId, widgetType, onItemClick }: { items: string[], onButtonClick?: () => void, spreadsheetId?: string, widgetType?: string, onItemClick?: (item: string) => void }) => {
  // 장부 관련 위젯(tuition)인 경우에만 장부 선택 메시지 표시
  const isAccountingWidget = widgetType === 'tuition';
  
  // 장부 관련 위젯이고, spreadsheetId가 없고, items가 비어있거나 "장부를 선택해주세요" 메시지인 경우에만 버튼 표시
  const shouldShowButton = isAccountingWidget && !spreadsheetId && (!items || items.length === 0 || (items.length === 1 && items[0] === '장부를 선택해주세요'));
  
  if (shouldShowButton) {
    return (
      <div className="widget-content">
        <p style={{ color: '#666666', marginBottom: '10px' }}>장부를 선택해주세요</p>
        {onButtonClick && (
          <button
            onClick={onButtonClick}
            style={{
              marginTop: '10px',
              padding: '8px 12px',
              backgroundColor: '#1a1a1a',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              width: '100%',
              fontSize: '14px'
            }}
          >
            장부 선택
          </button>
        )}
      </div>
    );
  }
  
  // 데이터가 없지만 장부가 선택된 경우 로딩 중 표시 (장부 관련 위젯만)
  if (isAccountingWidget && spreadsheetId && (!items || items.length === 0)) {
    return (
      <div className="widget-content">
        <p style={{ color: '#666666' }}>데이터를 불러오는 중...</p>
      </div>
    );
  }
  
  // 일반 위젯(공지사항 등)에서 데이터가 없는 경우
  if (!isAccountingWidget && (!items || items.length === 0)) {
    return (
      <div className="widget-content">
        <p style={{ color: '#666666' }}>데이터를 불러오는 중...</p>
      </div>
    );
  }

  return (
    <div className="widget-content">
      {items.map((item, index) => (
        <p 
          key={index} 
          onClick={() => onItemClick?.(item)}
          style={{ 
            marginBottom: '8px', 
            paddingBottom: '8px', 
            borderBottom: index < items.length - 1 ? '1px solid #f8fafc' : 'none',
            cursor: onItemClick ? 'pointer' : 'default',
            transition: 'background-color 0.2s'
          }}
          onMouseEnter={(e) => {
            if (onItemClick) {
              e.currentTarget.style.backgroundColor = '#f8fafc';
            }
          }}
          onMouseLeave={(e) => {
            if (onItemClick) {
              e.currentTarget.style.backgroundColor = 'transparent';
            }
          }}
        >
          {item}
        </p>
      ))}
    </div>
  );
};

/**
 * 교수님 연락처 위젯 컴포넌트입니다.
 * 사용자가 교수님 성함을 입력하고 이메일, 상담 예약, 전화, 쪽지 보내기 등의 옵션을 제공합니다.
 */
export const ProfessorContactWidget: React.FC = () => {
  return (
    <div className="widget-content">
      <input type="text" placeholder="교수님 성함을 입력하세요" />
      <div className="contact-option">
        <i className="fas fa-envelope"></i> 이메일 보내기
      </div>
      <div className="contact-option">
        <i className="fas fa-calendar-alt"></i> 상담 예약하기
      </div>
      <div className="contact-option">
        <i className="fas fa-phone-alt"></i> 전화 연결하기
      </div>
      <div className="contact-option">
        <i className="fas fa-comments"></i> 쪽지 보내기
      </div>
    </div>
  );
};

/**
 * 상태 목록을 표시하는 위젯 컴포넌트입니다.
 * @param {object} props - 컴포넌트 props
 * @param {{ name: string; status: string; icon: string; color: string }[]} props.items - 상태 항목 배열 (이름, 상태, 아이콘, 색상 포함)
 */
export const StatusListComponent = ({ items, onButtonClick }: { items: { name: string; status: string; icon: string; color: string }[], onButtonClick?: () => void }) => (
    <div className="widget-content">
        {items.length > 0 ? (
            items.map((item, index) => (
                <p key={index}>
                    <i className={item.icon} style={{ color: item.color, marginRight: '8px' }}></i>
                    {item.name} ({item.status})
                </p>
            ))
        ) : (
            <p>표시할 데이터가 없습니다.</p>
        )}
        <button
            onClick={onButtonClick}
            style={{
                marginTop: '10px',
                padding: '8px 12px',
                backgroundColor: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                width: '100%'
            }}
        >
            장부 선택
        </button>
    </div>
);

import { getScheduleEvents } from '../../../utils/database/personalConfigManager';


/**
 * 시간표 데이터를 동적으로 불러와 표시하는 컨테이너 위젯 컴포넌트입니다.
 */
export const TimetableWidget: React.FC = () => {
    const [items, setItems] = React.useState<{ time: string; course: string }[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);

    React.useEffect(() => {
        const fetchTimetableData = async () => {
            try {
                const events = await getScheduleEvents();
                const today = new Date();
                const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][today.getDay()];

                const formattedItems = events
                    .filter(event => event.date === dayOfWeek)
                    .map(event => ({
                        time: `${event.startTime} - ${event.endTime}`,
                        course: `${event.title} (${event.description})`
                    }))
                    .sort((a, b) => a.time.localeCompare(b.time));
                
                setItems(formattedItems);
            } catch (error) {
                console.error("Failed to fetch timetable for widget:", error);
                // 에러 발생 시 빈 배열로 설정하거나 에러 메시지를 표시할 수 있습니다.
                setItems([]);
            } finally {
                setIsLoading(false);
            }
        };

        fetchTimetableData();
    }, []);

    if (isLoading) {
        return <div className="widget-content"><p>시간표를 불러오는 중...</p></div>;
    }

    if (items.length === 0) {
        return <div className="widget-content"><p>오늘의 일정이 없습니다.</p></div>;
    }

    return <TimetableComponent items={items} />;
};

/**
 * 시간표를 표시하는 위젯 컴포넌트입니다.
 * @param {object} props - 컴포넌트 props
 * @param {{ time: string; course: string }[]} props.items - 시간표 항목 배열 (시간, 강좌 포함)
 */
export const TimetableComponent = ({ items }: { items: { time: string; course: string }[] }) => (
    <div className="widget-content">
        {items.map((item, index) => (
            <div key={index} className="timetable-item" style={{ display: 'flex', marginBottom: '8px' }}>
                <div className="timetable-time" style={{ marginRight: '16px', fontWeight: 'bold' }}>{item.time}</div>
                <div>{item.course}</div>
            </div>
        ))}
    </div>
);

/**
 * 날씨 정보를 표시하는 위젯 컴포넌트입니다.
 * @param {object} props - 컴포넌트 props
 * @param {{ icon: string; temp: string; description: string; humidity: string }} props.today - 오늘 날씨 정보 (아이콘, 온도, 설명, 습도 포함)
 * @param {{ day: string; icon: string; temp: string }[]} props.forecast - 주간 예보 정보 배열 (요일, 아이콘, 온도 포함)
 */
export const WeatherWidget = ({ today, forecast }: {
  today: { icon: string; temp: string; description: string; humidity: string };
  forecast: { day: string; icon: string; temp: string }[];
}) => {
  return (
    <div className="widget-content">
      <div className="weather-today">
        <div className="weather-icon"><i className={today.icon}></i></div>
        <div className="weather-temp">{today.temp}</div>
        <div>
          <div>{today.description}</div>
          <div>습도 {today.humidity}</div>
        </div>
      </div>

      <div className="weather-forecast">
        {forecast.map((item, index) => (
          <div key={index} className="forecast-day">
            <div>{item.day}</div>
            <div><i className={item.icon}></i></div>
            <div>{item.temp}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * 원형 그래프를 표시하는 위젯 컴포넌트입니다.
 * @param {object} props - 컴포넌트 props
 * @param {{ category: string; amount: number }[]} props.data - 그래프에 표시할 데이터 배열
 */
export const PieChartComponent = ({ data, onButtonClick, spreadsheetId }: { data: { category: string; amount: number }[], onButtonClick?: () => void, spreadsheetId?: string }) => {
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#AF19FF', '#FF1919'];
  const [isMounted, setIsMounted] = React.useState(false);

  // 컨테이너 크기 감지를 위한 ref
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    // 마운트 후 짧은 지연으로 크기 감지 (ResizeObserver 무한 루프 방지)
    const timer = setTimeout(() => {
      setIsMounted(true);
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  // 장부가 선택되지 않은 경우 장부 선택 버튼 표시
  if (!spreadsheetId) {
    return (
      <div className="widget-content">
        <p style={{ color: '#666666', marginBottom: '10px' }}>장부를 선택해주세요</p>
        {onButtonClick && (
          <button
            onClick={onButtonClick}
            style={{
              marginTop: '10px',
              padding: '8px 12px',
              backgroundColor: '#1a1a1a',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              width: '100%',
              fontSize: '14px'
            }}
          >
            장부 선택
          </button>
        )}
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="widget-content">
        <p style={{ color: '#666666' }}>데이터를 불러오는 중...</p>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className="widget-content" 
      style={{ 
        width: '100%', 
        height: '300px', 
        minHeight: '300px', 
        position: 'relative', 
        display: 'flex', 
        flexDirection: 'column',
        overflow: 'hidden'
      }}
    >
      {isMounted ? (
        <ResponsiveContainer width="100%" height="100%" minHeight={300}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              outerRadius={80}
              fill="#8884d8"
              dataKey="amount"
              nameKey="category"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(value: number) => `${value.toLocaleString()}원`} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#666' }}>
          그래프를 로딩하는 중...
        </div>
      )}
    </div>
  );
};

/**
 * 예산 계획 결재 대기 항목을 표시하는 위젯 컴포넌트입니다.
 * @param {object} props - 컴포넌트 props
 * @param {{ budget_id: string; title: string; total_amount: number; status: string; action_required: string }[]} props.items - 결재 대기 항목 배열
 * @param {() => void} props.onButtonClick - 장부 선택 버튼 클릭 핸들러
 */
export const BudgetPlanComponent = ({ items, onButtonClick, spreadsheetId }: { items: { budget_id: string; title: string; total_amount: number; status: string; action_required: string }[], onButtonClick?: () => void, spreadsheetId?: string }) => {
  if (!spreadsheetId) {
    return (
      <div className="widget-content">
        <p style={{ color: '#666666', marginBottom: '10px' }}>장부를 선택해주세요</p>
        {onButtonClick && (
          <button
            onClick={onButtonClick}
            style={{
              marginTop: '10px',
              padding: '8px 12px',
              backgroundColor: '#1a1a1a',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              width: '100%',
              fontSize: '14px'
            }}
          >
            장부 선택
          </button>
        )}
      </div>
    );
  }

  if (!items || items.length === 0) {
    return (
      <div className="widget-content">
        <p style={{ color: '#666666' }}>결재 대기 중인 예산 계획이 없습니다.</p>
      </div>
    );
  }

  const getActionLabel = (action: string) => {
    switch (action) {
      case 'review': return '검토';
      case 'approve': return '승인';
      case 'execute': return '집행';
      default: return '기타';
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'review': return { bg: '#fff3cd', color: '#856404' };
      case 'approve': return { bg: '#d1ecf1', color: '#0c5460' };
      case 'execute': return { bg: '#d4edda', color: '#155724' };
      default: return { bg: '#f8fafc', color: '#666666' };
    }
  };

  return (
    <div className="widget-content">
      {items.map((item, index) => {
        const actionColors = getActionColor(item.action_required);
        return (
          <div key={index} style={{ marginBottom: '12px', paddingBottom: '12px', borderBottom: index < items.length - 1 ? '1px solid #f8fafc' : 'none' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <span style={{ fontWeight: '500', fontSize: '14px', flex: 1 }}>{item.title}</span>
              <span style={{ 
                fontSize: '12px', 
                padding: '2px 8px', 
                borderRadius: '4px',
                backgroundColor: actionColors.bg,
                color: actionColors.color,
                marginLeft: '8px'
              }}>
                {getActionLabel(item.action_required)}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
              <span style={{ fontSize: '12px', color: '#666666' }}>{item.budget_id}</span>
              <span style={{ fontSize: '14px', fontWeight: '600', color: '#1a1a1a' }}>
                {item.total_amount.toLocaleString()}원
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
};

/**
 * 워크플로우 현황을 표시하는 위젯 컴포넌트입니다.
 * @param {object} props - 컴포넌트 props
 * @param {{ title: string; status: string; date: string }[]} props.items - 워크플로우 항목 배열
 */
export const WorkflowStatusComponent = ({ items, onItemClick }: { items: { title: string; status: string; date: string }[], onItemClick?: () => void }) => (
  <div className="widget-content">
    {items.length > 0 ? (
      items.map((item, index) => (
        <div 
          key={index} 
          onClick={onItemClick}
          style={{ 
            marginBottom: '8px', 
            paddingBottom: '8px', 
            borderBottom: index < items.length - 1 ? '1px solid #f8fafc' : 'none',
            cursor: onItemClick ? 'pointer' : 'default',
            padding: '8px',
            borderRadius: '4px',
            transition: 'background-color 0.2s'
          }}
          onMouseEnter={(e) => {
            if (onItemClick) {
              e.currentTarget.style.backgroundColor = '#f8fafc';
            }
          }}
          onMouseLeave={(e) => {
            if (onItemClick) {
              e.currentTarget.style.backgroundColor = 'transparent';
            }
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
            <span style={{ fontWeight: '500', fontSize: '14px' }}>{item.title}</span>
            <span style={{ 
              fontSize: '12px', 
              padding: '2px 8px', 
              borderRadius: '4px',
              backgroundColor: item.status === '검토중' ? '#fff3cd' : item.status === '결재중' ? '#d1ecf1' : '#d4edda',
              color: item.status === '검토중' ? '#856404' : item.status === '결재중' ? '#0c5460' : '#155724'
            }}>
              {item.status}
            </span>
          </div>
          <div style={{ fontSize: '12px', color: '#666666' }}>{item.date}</div>
        </div>
      ))
    ) : (
      <p style={{ color: '#666666' }}>대기 중인 결재가 없습니다.</p>
    )}
  </div>
);

/**
 * 학생 관리 요약을 표시하는 위젯 컴포넌트입니다.
 * @param {object} props - 컴포넌트 props
 * @param {{ label: string; value: string }[]} props.items - 통계 항목 배열
 * @param {string} props.selectedStatus - 선택된 학생 상태 (재학, 휴학, 유급)
 * @param {(status: string) => void} props.onStatusChange - 상태 변경 핸들러
 */
export const StudentSummaryComponent = ({ items, selectedStatus, onStatusChange, rawData, onGradeClick }: { items: { label: string; value: string }[], selectedStatus?: string, onStatusChange?: (status: string) => void, rawData?: { status: string; grade: string; count: number }[], onGradeClick?: (status: string, grade: string) => void }) => {
  const [currentStatus, setCurrentStatus] = React.useState<string>(selectedStatus || '재학');
  
  // selectedStatus prop이 변경되면 state 업데이트
  React.useEffect(() => {
    if (selectedStatus) {
      setCurrentStatus(selectedStatus);
    }
  }, [selectedStatus]);
  
  const statusOptions = ['재학', '휴학', '유급'];
  
  const handleStatusChange = (status: string) => {
    setCurrentStatus(status);
    onStatusChange?.(status);
  };
  
  // rawData가 있으면 선택된 상태에 따라 필터링된 데이터 표시
  const filteredData = rawData && rawData.length > 0
    ? rawData.filter(item => item.status === currentStatus)
    : [];
  
  const displayItems = filteredData.length > 0
    ? filteredData
        .sort((a, b) => parseInt(a.grade) - parseInt(b.grade)) // 학년 순서대로 정렬
        .map(item => ({
          label: `${item.grade}학년`,
          value: `${item.count}명`
        }))
    : items;
  
  // 선택된 상태의 총원 계산
  const totalCount = filteredData.length > 0
    ? filteredData.reduce((sum, item) => sum + item.count, 0)
    : 0;
  
  return (
    <div className="widget-content">
      {/* 상태 선택 토글 버튼 */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '10px', justifyContent: 'flex-end' }}>
        {statusOptions.map((status) => (
          <button
            key={status}
            onClick={() => handleStatusChange(status)}
            style={{
              padding: '3px 10px',
              fontSize: '11px',
              border: '1px solid #e5e7eb',
              borderRadius: '4px',
              cursor: 'pointer',
              backgroundColor: currentStatus === status ? '#1a1a1a' : 'white',
              color: currentStatus === status ? 'white' : '#1a1a1a',
              transition: 'all 0.2s'
            }}
          >
            {status}
          </button>
        ))}
      </div>
      
      {/* 선택된 상태의 학년별 학생 수 표시 */}
      {displayItems.length > 0 ? (
        <>
          {displayItems.map((item, index) => {
            // 학년 추출 (예: "1학년" -> "1")
            const grade = item.label.replace('학년', '');
            return (
              <div 
                key={index} 
                onClick={() => onGradeClick?.(currentStatus, grade)}
                style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  marginBottom: '8px', 
                  paddingBottom: '8px', 
                  borderBottom: index < displayItems.length - 1 ? '1px solid #f8fafc' : 'none',
                  cursor: onGradeClick ? 'pointer' : 'default',
                  padding: '8px',
                  borderRadius: '4px',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => {
                  if (onGradeClick) {
                    e.currentTarget.style.backgroundColor = '#f8fafc';
                  }
                }}
                onMouseLeave={(e) => {
                  if (onGradeClick) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
              >
                <span><i className="fas fa-user-graduate" style={{ marginRight: '8px', color: '#1a1a1a' }}></i>{item.label}</span>
                <span style={{ fontWeight: '600' }}>{item.value}</span>
              </div>
            );
          })}
          {/* 총원 표시 */}
          {totalCount > 0 && (
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              marginTop: '12px', 
              paddingTop: '12px', 
              borderTop: '2px solid #a0aec0',
              fontWeight: '700',
              fontSize: '15px'
            }}>
              <span><i className="fas fa-users" style={{ marginRight: '8px', color: '#1a1a1a' }}></i>총원</span>
              <span style={{ fontWeight: '700', color: '#1a1a1a' }}>{totalCount}명</span>
            </div>
          )}
        </>
      ) : (
        <p style={{ color: '#666666' }}>데이터가 없습니다.</p>
      )}
    </div>
  );
};

/**
 * 교직원 관리 요약을 표시하는 위젯 컴포넌트입니다.
 * @param {object} props - 컴포넌트 props
 * @param {{ label: string; value: string }[]} props.items - 통계 항목 배열
 */
export const StaffSummaryComponent = ({ items }: { items: { label: string; value: string }[] }) => (
  <div className="widget-content">
    {items.map((item, index) => (
      <div key={index} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', paddingBottom: '8px', borderBottom: index < items.length - 1 ? '1px solid #f8fafc' : 'none' }}>
        <span><i className="fas fa-user-tie" style={{ marginRight: '8px', color: '#1a1a1a' }}></i>{item.label}</span>
        <span style={{ fontWeight: '600' }}>{item.value}</span>
      </div>
    ))}
  </div>
);

/**
 * 사용자 승인 대기를 표시하는 위젯 컴포넌트입니다.
 * @param {object} props - 컴포넌트 props
 * @param {{ name: string; email: string; userType: string }[]} props.items - 승인 대기 사용자 배열
 */
export const UserApprovalComponent = ({ items, onItemClick }: { items: { name: string; email: string; userType: string }[], onItemClick?: () => void }) => (
  <div className="widget-content">
    {items.length > 0 ? (
      items.map((item, index) => (
        <div 
          key={index} 
          onClick={onItemClick}
          style={{ 
            marginBottom: '8px', 
            paddingBottom: '8px', 
            borderBottom: index < items.length - 1 ? '1px solid #f8fafc' : 'none',
            cursor: onItemClick ? 'pointer' : 'default',
            padding: '8px',
            borderRadius: '4px',
            transition: 'background-color 0.2s'
          }}
          onMouseEnter={(e) => {
            if (onItemClick) {
              e.currentTarget.style.backgroundColor = '#f8fafc';
            }
          }}
          onMouseLeave={(e) => {
            if (onItemClick) {
              e.currentTarget.style.backgroundColor = 'transparent';
            }
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
            <span style={{ fontWeight: '500', fontSize: '14px' }}>{item.name}</span>
            <span style={{ fontSize: '12px', color: '#666666', padding: '2px 8px', borderRadius: '4px', backgroundColor: '#f8fafc' }}>
              {item.userType === 'student' ? '학생' : 
               item.userType === 'std_council' ? '집행부' :
               item.userType === 'supp' ? '조교' :
               item.userType === 'professor' ? '교수' :
               item.userType === 'ad_professor' ? '겸임교원' : item.userType}
            </span>
          </div>
          <div style={{ fontSize: '12px', color: '#666666' }}>{item.email}</div>
        </div>
      ))
    ) : (
      <p style={{ color: '#666666' }}>승인 대기 사용자가 없습니다.</p>
    )}
  </div>
);

/**
 * 시스템 통계를 표시하는 위젯 컴포넌트입니다.
 * @param {object} props - 컴포넌트 props
 * @param {{ label: string; value: string }[]} props.items - 통계 항목 배열
 */
export const SystemStatsComponent = ({ items }: { items: { label: string; value: string }[] }) => (
  <div className="widget-content">
    {items.map((item, index) => (
      <div key={index} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', paddingBottom: '8px', borderBottom: index < items.length - 1 ? '1px solid #f8fafc' : 'none' }}>
        <span><i className="fas fa-chart-bar" style={{ marginRight: '8px', color: '#1a1a1a' }}></i>{item.label}</span>
        <span style={{ fontWeight: '600' }}>{item.value}</span>
      </div>
    ))}
  </div>
);

/**
 * 문서 관리를 표시하는 위젯 컴포넌트입니다.
 * @param {object} props - 컴포넌트 props
 * @param {{ title: string; date: string; type: string }[]} props.items - 문서 항목 배열
 */
export const DocumentManagementComponent = ({ items, onItemClick }: { items: { title: string; date: string; type: string; url?: string }[], onItemClick?: (item: { title: string; url?: string }) => void }) => (
  <div className="widget-content">
    {items.length > 0 ? (
      items.map((item, index) => (
        <div 
          key={index} 
          onClick={() => onItemClick?.(item)}
          style={{ 
            marginBottom: '8px', 
            paddingBottom: '8px', 
            borderBottom: index < items.length - 1 ? '1px solid #f8fafc' : 'none',
            cursor: onItemClick ? 'pointer' : 'default',
            padding: '8px',
            borderRadius: '4px',
            transition: 'background-color 0.2s'
          }}
          onMouseEnter={(e) => {
            if (onItemClick) {
              e.currentTarget.style.backgroundColor = '#f8fafc';
            }
          }}
          onMouseLeave={(e) => {
            if (onItemClick) {
              e.currentTarget.style.backgroundColor = 'transparent';
            }
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
            <span style={{ fontWeight: '500', fontSize: '14px' }}>{item.title}</span>
            <span style={{ fontSize: '12px', color: '#666666', padding: '2px 8px', borderRadius: '4px', backgroundColor: '#f8fafc' }}>
              {item.type === 'shared' ? '공용' : '개인'}
            </span>
          </div>
          <div style={{ fontSize: '12px', color: '#666666' }}>{item.date}</div>
        </div>
      ))
    ) : (
      <p style={{ color: '#666666' }}>최근 문서가 없습니다.</p>
    )}
  </div>
);

/**
 * 예산 집행 현황을 표시하는 위젯 컴포넌트입니다.
 * @param {object} props - 컴포넌트 props
 * @param {{ label: string; reviewerCount: string; reviewProgress: number; approvalProgress: number; executionProgress: number }[]} props.items - 집행 현황 항목 배열
 * @param {() => void} props.onButtonClick - 장부 선택 버튼 클릭 핸들러
 */
export const BudgetExecutionComponent = ({ items, onButtonClick }: { items: { label: string; reviewerCount: string; reviewProgress: number; approvalProgress: number; executionProgress: number }[], onButtonClick?: () => void }) => (
  <div className="widget-content">
    {items.length > 0 && items[0].label === '장부를 선택해주세요' ? (
      <div>
        <p style={{ color: '#666666', marginBottom: '10px' }}>장부를 선택해주세요</p>
        <button
          onClick={onButtonClick}
          style={{
            marginTop: '10px',
            padding: '8px 12px',
            backgroundColor: '#1a1a1a',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            width: '100%',
            fontSize: '14px'
          }}
        >
          장부 선택
        </button>
      </div>
    ) : (
      items.map((item, index) => {
        // 전체 진행률 계산: 검토(33%) + 승인(33%) + 집행(33%)
        const totalProgress = (item.reviewProgress * 33.33) + (item.approvalProgress * 33.33) + (item.executionProgress * 33.34);
        const reviewSectionEnd = 33.33;
        const approvalSectionEnd = 66.66;
        
        return (
          <div key={index} style={{ marginBottom: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span style={{ fontWeight: '500', fontSize: '14px' }}><i className="fas fa-chart-pie" style={{ marginRight: '8px', color: '#1a1a1a' }}></i>{item.label}</span>
              <span style={{ fontSize: '12px', color: '#666666' }}>검토: {item.reviewerCount}</span>
            </div>
            
            {/* 통합 진행 바 */}
            <div style={{ position: 'relative', height: '20px', backgroundColor: '#e5e7eb', borderRadius: '4px', overflow: 'hidden', marginBottom: '4px' }}>
              {/* 검토 구간 - 진행된 부분만 표시 */}
              {item.reviewProgress > 0 && (
                <div style={{
                  position: 'absolute',
                  left: 0,
                  width: `${item.reviewProgress * reviewSectionEnd}%`,
                  height: '100%',
                  backgroundColor: item.reviewProgress === 1 ? '#10b981' : '#f59e0b',
                  transition: 'width 0.3s ease'
                }}></div>
              )}
              
              {/* 승인 구간 - 진행된 부분만 표시 */}
              {item.approvalProgress > 0 && item.reviewProgress === 1 && (
                <div style={{
                  position: 'absolute',
                  left: `${reviewSectionEnd}%`,
                  width: `${item.approvalProgress * (approvalSectionEnd - reviewSectionEnd)}%`,
                  height: '100%',
                  backgroundColor: '#10b981',
                  transition: 'width 0.3s ease'
                }}></div>
              )}
              
              {/* 집행 구간 - 진행된 부분만 표시 */}
              {item.executionProgress > 0 && item.approvalProgress === 1 && (
                <div style={{
                  position: 'absolute',
                  left: `${approvalSectionEnd}%`,
                  width: `${item.executionProgress * (100 - approvalSectionEnd)}%`,
                  height: '100%',
                  backgroundColor: '#10b981',
                  transition: 'width 0.3s ease'
                }}></div>
              )}
              
              {/* 단계 구분선 및 라벨 */}
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '100%', pointerEvents: 'none' }}>
                {/* 검토 구분선 */}
                <div style={{ 
                  position: 'absolute', 
                  left: `${reviewSectionEnd}%`, 
                  top: 0, 
                  bottom: 0, 
                  width: '1px', 
                  backgroundColor: '#cbd5e1',
                  zIndex: 1
                }}></div>
                <div style={{ 
                  position: 'absolute', 
                  left: `${reviewSectionEnd / 2}%`, 
                  top: '50%', 
                  transform: 'translate(-50%, -50%)',
                  fontSize: '10px',
                  color: '#666666',
                  fontWeight: '500',
                  zIndex: 2
                }}>검토</div>
                
                {/* 승인 구분선 */}
                <div style={{ 
                  position: 'absolute', 
                  left: `${approvalSectionEnd}%`, 
                  top: 0, 
                  bottom: 0, 
                  width: '1px', 
                  backgroundColor: '#cbd5e1',
                  zIndex: 1
                }}></div>
                <div style={{ 
                  position: 'absolute', 
                  left: `${reviewSectionEnd + (approvalSectionEnd - reviewSectionEnd) / 2}%`, 
                  top: '50%', 
                  transform: 'translate(-50%, -50%)',
                  fontSize: '10px',
                  color: '#666666',
                  fontWeight: '500',
                  zIndex: 2
                }}>승인</div>
                
                {/* 집행 라벨 */}
                <div style={{ 
                  position: 'absolute', 
                  left: `${approvalSectionEnd + (100 - approvalSectionEnd) / 2}%`, 
                  top: '50%', 
                  transform: 'translate(-50%, -50%)',
                  fontSize: '10px',
                  color: '#666666',
                  fontWeight: '500',
                  zIndex: 2
                }}>집행</div>
              </div>
            </div>
            
            {/* 상태 표시 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#666666' }}>
              <span>검토: {isNaN(item.reviewProgress) ? '0' : (item.reviewProgress * 100).toFixed(0)}%</span>
              <span>승인: {item.approvalProgress === 1 ? '완료' : '대기'}</span>
              <span>집행: {item.executionProgress === 1 ? '완료' : '대기'}</span>
            </div>
          </div>
        );
      })
    )}
  </div>
);

/**
 * 회계 통계를 표시하는 위젯 컴포넌트입니다.
 * @param {object} props - 컴포넌트 props
 * @param {{ label: string; income: string; expense: string; balance: string }[]} props.items - 통계 항목 배열
 * @param {() => void} props.onButtonClick - 장부 선택 버튼 클릭 핸들러
 */
export const AccountingStatsComponent = ({ items, onButtonClick, spreadsheetId, rawData }: { items: { label: string; income: string; expense: string; balance: string; balanceValue?: number }[], onButtonClick?: () => void, spreadsheetId?: string, rawData?: { category: string; income: number; expense: number }[] }) => {
  const [viewMode, setViewMode] = React.useState<'category' | 'summary' | 'chart'>('category');
  const [loadedRawData, setLoadedRawData] = React.useState<{ category: string; income: number; expense: number }[] | null>(rawData || null);
  const [isChartMounted, setIsChartMounted] = React.useState(false);
  const chartContainerRef = React.useRef<HTMLDivElement>(null);
  
  // rawData가 없고 spreadsheetId가 있으면 데이터 다시 로드
  React.useEffect(() => {
    if (!loadedRawData && spreadsheetId && items && items.length > 0 && items[0].label !== '장부를 선택해주세요') {
      const loadRawData = async () => {
        try {
          const { getAccountingCategorySummary } = await import("../../../utils/google/googleSheetUtils");
          const summary = await getAccountingCategorySummary(spreadsheetId);
          if (summary && summary.length > 0) {
            setLoadedRawData(summary);
            console.log('📊 rawData 재로드 완료:', summary.length, '개 카테고리');
          }
        } catch (error) {
          console.error('❌ rawData 재로드 실패:', error);
        }
      };
      loadRawData();
    } else if (rawData && rawData !== loadedRawData) {
      setLoadedRawData(rawData);
    }
  }, [spreadsheetId, items, rawData, loadedRawData]);

  // 차트 모드일 때 마운트 상태 관리 (ResizeObserver 무한 루프 방지)
  React.useEffect(() => {
    if (viewMode === 'chart') {
      // 짧은 지연으로 마운트 상태 설정
      const timer = setTimeout(() => {
        setIsChartMounted(true);
      }, 100);
      return () => {
        clearTimeout(timer);
        setIsChartMounted(false);
      };
    } else {
      setIsChartMounted(false);
    }
  }, [viewMode]);
  
  // 통합 보기를 위한 수입/지출 합계 계산
  let totalIncome = 0;
  let totalExpense = 0;
  
  const dataToUse = loadedRawData || rawData;
  if (dataToUse && Array.isArray(dataToUse) && dataToUse.length > 0) {
    // rawData에서 직접 계산
    totalIncome = dataToUse.reduce((sum, item) => sum + (Number(item.income) || 0), 0);
    totalExpense = dataToUse.reduce((sum, item) => sum + (Number(item.expense) || 0), 0);
    console.log('📊 통합 보기 계산 (rawData 사용):', { 
      totalIncome, 
      totalExpense, 
      rawDataLength: dataToUse.length,
      rawDataSample: dataToUse.slice(0, 2)
    });
  } else {
    // rawData가 없으면 경고 로그
    console.warn('⚠️ rawData가 없습니다. rawData:', dataToUse, 'items:', items?.slice(0, 2), 'spreadsheetId:', spreadsheetId);
  }
  
  const totalBalance = totalIncome - totalExpense;
  const totalBalanceStr = totalBalance >= 0 
    ? `+${totalBalance.toLocaleString()}원` 
    : `${totalBalance.toLocaleString()}원`;
  const totalBalanceColor = totalBalance >= 0 ? '#10b981' : '#ef4444';
  
  return (
    <div className="widget-content">
      {(!spreadsheetId || (items.length > 0 && items[0].label === '장부를 선택해주세요')) ? (
        <div>
          <p style={{ color: '#666666', marginBottom: '10px' }}>장부를 선택해주세요</p>
          {onButtonClick && (
            <button
              onClick={onButtonClick}
              style={{
                marginTop: '10px',
                padding: '8px 12px',
                backgroundColor: '#1a1a1a',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                width: '100%',
                fontSize: '14px'
              }}
            >
              장부 선택
            </button>
          )}
        </div>
      ) : items.length > 0 ? (
        <>
          {/* 보기 모드 토글 버튼 */}
          <div style={{ display: 'flex', gap: '6px', marginBottom: '8px', justifyContent: 'flex-end' }}>
            <button
              onClick={() => setViewMode('category')}
              style={{
                padding: '3px 10px',
                fontSize: '11px',
                border: '1px solid #e5e7eb',
                borderRadius: '4px',
                cursor: 'pointer',
                backgroundColor: viewMode === 'category' ? '#1a1a1a' : 'white',
                color: viewMode === 'category' ? 'white' : '#1a1a1a',
                transition: 'all 0.2s'
              }}
            >
              카테고리별
            </button>
            <button
              onClick={() => setViewMode('chart')}
              style={{
                padding: '3px 10px',
                fontSize: '11px',
                border: '1px solid #e5e7eb',
                borderRadius: '4px',
                cursor: 'pointer',
                backgroundColor: viewMode === 'chart' ? '#1a1a1a' : 'white',
                color: viewMode === 'chart' ? 'white' : '#1a1a1a',
                transition: 'all 0.2s'
              }}
            >
              그래프
            </button>
            <button
              onClick={() => setViewMode('summary')}
              style={{
                padding: '3px 10px',
                fontSize: '11px',
                border: '1px solid #e5e7eb',
                borderRadius: '4px',
                cursor: 'pointer',
                backgroundColor: viewMode === 'summary' ? '#1a1a1a' : 'white',
                color: viewMode === 'summary' ? 'white' : '#1a1a1a',
                transition: 'all 0.2s'
              }}
            >
              통합
            </button>
          </div>
          
          {/* 카테고리별 보기 */}
          {viewMode === 'category' ? (
            items.map((item, index) => {
              const balanceValue = item.balanceValue !== undefined 
                ? item.balanceValue 
                : parseFloat(item.balance.replace(/[^-\d.]/g, '')) || 0;
              const balanceColor = balanceValue >= 0 ? '#10b981' : '#ef4444';
              
              return (
                <div key={index} style={{ marginBottom: '12px', paddingBottom: '12px', borderBottom: index < items.length - 1 ? '1px solid #f8fafc' : 'none' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontWeight: '500', fontSize: '14px' }}>{item.label}</div>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: balanceColor }}>
                      {item.balance}
                    </div>
                  </div>
                </div>
              );
            })
          ) : viewMode === 'chart' ? (
            /* 그래프 보기 */
            <div 
              ref={chartContainerRef}
              style={{ width: '100%', height: '220px', minHeight: '220px', position: 'relative', marginTop: '-4px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
            >
              {isChartMounted ? (
                <ResponsiveContainer width="100%" height="100%" minHeight={220}>
                  <BarChart 
                  data={dataToUse?.map(item => ({
                    name: item.category,
                    수입: item.income,
                    지출: item.expense
                  })) || []} 
                  margin={{ top: 5, right: 10, left: 0, bottom: 40 }}
                  barCategoryGap="20%"
                  barGap={4}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis 
                    dataKey="name" 
                    angle={-45} 
                    textAnchor="end" 
                    height={60}
                    tick={{ fontSize: 9 }}
                    interval={0}
                    width={60}
                  />
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
                    contentStyle={{ 
                      fontSize: '10px', 
                      padding: '5px 6px',
                      borderRadius: '4px',
                      border: '1px solid #e5e7eb'
                    }}
                  />
                  <Legend 
                    wrapperStyle={{ fontSize: '10px', paddingTop: '6px' }}
                    iconSize={8}
                  />
                  <Bar dataKey="수입" fill="#10b981" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="지출" fill="#ef4444" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#666' }}>
                  그래프를 로딩하는 중...
                </div>
              )}
            </div>
          ) : (
            /* 통합 보기 */
            <div>
              <div style={{ marginBottom: '12px', paddingBottom: '12px', borderBottom: '1px solid #f8fafc' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div style={{ fontWeight: '500', fontSize: '14px' }}>수입</div>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: '#10b981' }}>
                    +{totalIncome.toLocaleString()}원
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontWeight: '500', fontSize: '14px' }}>지출</div>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: '#ef4444' }}>
                    -{totalExpense.toLocaleString()}원
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '8px' }}>
                <div style={{ fontWeight: '600', fontSize: '15px' }}>요약</div>
                <div style={{ fontSize: '15px', fontWeight: '700', color: totalBalanceColor }}>
                  {totalBalanceStr}
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        <div>
          <p style={{ color: '#666666', marginBottom: '10px' }}>데이터를 불러오는 중...</p>
        </div>
      )}
    </div>
  );
};